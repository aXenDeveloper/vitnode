# Mentions (`@nick`)

Status: implemented (phases 1-5); tests still to write in a separate session.
Owner: core (`@vitnode/api` + `@vitnode/core`).

## Implemented differently from this plan

- **Per-role cap, not a global setting.** `core_roles.maxMentionsPerItem`
  (default 25, `null` = unlimited) sits next to `allowMentions` in **Edit role
  → Content**. There is no `mentions.maxNotifiedPerItem` in Settings.
- **Retraction recounts groups.** `notifications.remove()` deletes whole inbox
  items, so a removed mention detaches its own event instead
  (`detachNotificationEvents`, event id stored in `core_mentions.eventId`): a
  grouped "Anna and 1 other person" drops back to "Anna". The type's `access`
  also requires the `core_mentions` row, so an event retracted before its
  fan-out never reaches anyone.
- **One hook for every write path.** `emitContentEvent` queues a
  `content-mentions` task (created, updated with a mention field in
  `changedFields`, published, unhidden, translation writes, deleted) instead
  of `recordContentMentions` at each call site. The task reloads the record,
  skips it unless public, and calls `syncMentions`. Approvals and scheduled
  publishes go through `emitContentEvent` too.
- **Actor is the record's author** (search author field, else the public
  write owner), so a moderator's edit or approval still notifies as the
  author, with the author's role policy.
- **Titles and links** come from the type's `threadReply` rule for replies,
  otherwise from the record's search entry or row (as reaction timelines do).
- **No server-side `resolveMentionedUsers`.** Emails and RSS don't render rich
  text today, so only the browser resolves current names
  (`GET /users/mentioned`, batched across the page in one request).
- **Suggestions leave out the member typing.** No extra indexes on
  `core_users` yet; the search is `ILIKE` with a prefix rank.
- **Not done yet:** the daily cleanup cron for rows of records deleted by a
  cascade (their notifications are already hidden by `access`), the slash-menu
  item, mentions in rich-text fields nested inside a `field.group`, and
  thread participants first in the popup.

Type `@` in any rich-text editor (on by default), pick a member from the
popup, and the post shows `@Name` as a link with the user preview card. Once the
post is public and readable by that member, they get a **"Anna mentioned you in
…"** notification (in-app, email optional).

## Goals

1. **One mention node for every editor.** Comments, forum topics, blog posts,
   newsroom articles and the AdminCP live editor all use the same TipTap node,
   the same popup and the same stored shape.
2. **On by default, opt-out per field.** Every `field.richText()` and every
   `AutoFormEditor` / `TipTapEditor` supports mentions with no config. A field
   that shouldn't have them turns them off: `field.richText({ mentions: false })`
   on the server and `mentions={false}` on the editor.
3. **Notify once, only people who can read it.** A member is notified the first
   time a public record mentions them. Edits notify only newly added people.
   Drafts, pending approval, hidden records and records the member can't read
   notify nobody.
4. **Plugins outside the Content Engine can use it too**, through
   `defineMentionTarget`, like `defineReactionTarget`.

## What already exists (and what we reuse)

| Piece                     | Where                                                         | How we use it                                                                                                               |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| TipTap 3 + `@tiptap/suggestion` | `packages/vitnode/src/components/tiptap/*`              | The `@` popup copies the emoji `:` popup (`emoji/emoji-suggestion.ts`, `suggestion-popup.ts`, `useActiveDescendant`).        |
| Extension list            | `components/tiptap/extension.ts` (`createTipTapExtensions`)   | Mention node added here, so `richTextDocumentFromHtml` round-trips it too.                                                   |
| Stored JSON               | `@vitnode/api/content/rich-text/document.ts`                  | No allow-list on save: a `mention` node already passes validation. No schema change needed.                                 |
| Render allow-list         | `content/rich-text/elements.ts` (`richTextNodeElement`)       | New `case "mention"`. Today an atom `mention` renders **nothing** (unknown nodes render only children).                      |
| Plain text                | `content/rich-text/plain-text.ts`                             | Already prints `attrs.label` for unknown inline nodes; change it to `@label` for `mention`.                                  |
| Email/RSS HTML            | `content/rich-text/html.ts` (`richTextToHtml`)                | New `mention` case (absolute profile link). Today it renders nothing.                                                        |
| File-id walker            | `content/access/server/files.ts` (`richTextFileIdsOf`)        | Same walker shape for `richTextMentionsOf`.                                                                                  |
| Preview card              | `components/user-preview.tsx` (`UserPreview`)                 | Mentions render through it (listed as "possible later" in `user-preview-card.md`).                                          |
| Notifications             | `buildNotificationType`, `c.get("notifications").publish`    | New core type `core.mention`; settings page, AdminCP policy and email channel come for free.                                 |
| CE notification intents   | `content/server/notifications/intents.ts`, `process.ts`      | New durable intent `mentions`, processed by the same task, under the same public-state checks.                              |
| CE read access            | `contentNotificationAccess({ policy: "content" })`            | Filters recipients on delivery, before every email and on every inbox load.                                                  |
| Reaction targets          | `lib/reactions/targets.ts`, `content/server/reaction-target.ts` | The pattern for `defineMentionTarget` + automatic `contentMentionTarget` per content type.                                  |

Missing today: a member-facing user search (`/search/authors` only finds
authors of public content, `/moderation/members` is staff-only), a CE trigger on
**edit**, and any block/ignore feature.

## Decisions

- **Official `@tiptap/extension-mention`** (`^3.33.0`, same line as the other
  TipTap packages, added to `packages/vitnode` only), extended with one attr.
  Writing our own node on top of `Suggestion` buys nothing.
- **Stored node:**

  ```json
  {
    "type": "mention",
    "attrs": { "id": 42, "label": "Anna Nowak", "nameCode": "anna-nowak" }
  }
  ```

  `id` is the source of truth for everything: notifications, extraction **and
  the link**. `label` and `nameCode` are only a fallback snapshot - for the
  first paint, plain text and the search index.
- **Links resolve by `id`, so renames never break them.** The renderer looks up
  the current `name` and `nameCode` of every mentioned id in one batched call
  (`GET /users/mentioned?ids=`, see Server §2b) and links to
  `/profile/{current nameCode}` with the current name. Until the lookup answers
  it shows the snapshot (no skeleton - the snapshot is real content). A deleted
  member renders as plain `@label` text with no link. No nameCode history table.
- **Validated at render, not trusted.** The renderer drops the link (keeps
  `@label` as text) unless `id` is a positive integer and `nameCode` matches the
  nameCode pattern. `label` is text only, capped at 255 chars.
- **Roles decide who can mention, with no daily limit.** New role setting
  `allowMentions` (default `true`, guests `false`), the most generous of the
  primary and secondary roles wins. A member without it gets no `@` popup,
  `GET /users/mentions` answers `403`, and their mentions still render as links
  but notify nobody (checked in `syncMentions` on the actor).
- **Anyone can be picked, only readers are notified.** The popup doesn't check
  access to the current record. `syncMentions` stores every mentioned member but
  publishes only to those the target's `access` lets read it; fan-out, every
  inbox load and every email check `access` again, so a member who loses
  access later stops seeing the notification.
- **On by default.** The server scans every rich-text field except those with
  `mentions: false`; a mention node pasted into an opted-out field still renders
  as a profile link but notifies nobody. The editor shows the `@` popup unless
  `mentions={false}`. Rich text outside the Content Engine (warnings, report
  notes, plugin tables) gets the popup and rendering too, but notifies only
  where that feature calls `syncMentions` with its own target - a mention never
  notifies through a target that can't check read access.
- **Two switches, not one.** The form can't read the server's field config, so
  an opted-out field sets `mentions: false` on the field **and**
  `mentions={false}` on its `AutoFormEditor`. Forgetting the editor side only
  shows a popup whose mentions don't notify - never a leak.
- **One row per (target, user)** in `core_mentions`, mirroring the mentions in
  the current text. Insert `ON CONFLICT DO NOTHING RETURNING` decides who is
  new, so saves and retries never notify twice.
- **Removing a mention retracts its notification.** Users in `core_mentions`
  but no longer in the text lose their row and their notification
  (their event is detached, so a grouped item is recounted), read or not. An email that
  already went out can't be unsent. Adding them back later is a new mention and
  notifies again - the idempotency key is the new row's id, so the old key
  doesn't swallow it.
- **The worker re-reads the record.** The intent carries ids only; the worker
  loads the current row, checks it is public, extracts mentions from the current
  values (all published translations of a localized field) and diffs against
  `core_mentions`. A stale intent can't notify about text that was removed.
- **Cap: 10 notified members per record** (`mentions.maxNotifiedPerItem`,
  AdminCP → Settings → Content, 0 = no cap). This is spam protection for one
  post, not a limit on mentioning: more mentions still render, and the rest are
  stored with `notified = false`. Only members who pass `access` count.
- **No double notification for a reply.** When the record also triggers a
  `threadReply` notification, the mention worker skips the users that rule
  already notifies (root and parent authors).
- **Suggestions need a signed-in member.** Guests get no popup (the extension
  isn't loaded), so the endpoint never helps enumerate members anonymously.
- **Self-mentions render but don't notify** (`publish` already drops the actor).

## Data model

### `packages/api/src/database/mentions.ts`

```ts
export const core_mentions = pgTable(
  "core_mentions",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    targetType: t.varchar({ length: 100 }).notNull(), // content type id or custom target id
    targetId: t.integer().notNull(),
    userId: t.integer().notNull().references(() => core_users.id, { onDelete: "cascade" }),
    actorId: t.integer().references(() => core_users.id, { onDelete: "set null" }),
    notified: t.boolean().notNull().default(false),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    uniqueIndex().on(t.pluginId, t.targetType, t.targetId, t.userId),
    index().on(t.userId, t.createdAt), // "mentions of me" later
  ],
);
```

Polymorphic target, so no FK to it: CE delete effects remove the rows, and a
daily `mentions-cleanup` cron (like `reactions-cleanup`) removes rows of records
deleted by a cascade.

### Changes to existing tables

- `core_roles.allowMentions boolean not null default true`; the seed sets it to
  `false` for the guest role.
- Two indexes for the suggestion search on `core_users`:
  `lower(name_code) text_pattern_ops` and `lower(name) text_pattern_ops`.

## Server

### 1. Pure helpers (`@vitnode/api/content/rich-text/mentions.ts`, browser-safe)

- `richTextMentionsOf(doc): { id: number; label: string; nameCode: string }[]`
  - unique by `id`, document order, invalid attrs skipped.
- `MENTION_NODE = "mention"` and the attr schema, shared by the editor and the
  renderer.

### 2. Suggestions: `GET /users/mentions?search=&limit=`

- Core `users` module, requires a user session and `allowMentions` on one of
  the member's roles (`403` otherwise), `search` rate-limit category.
- No access check against the record being written - every active member can
  be suggested (decided; notifications filter by access instead).
- Matches `nameCode` prefix first, then `name` prefix, then `name` contains;
  skips deleted and banned members; `limit` default 6, max 10; `search` 1–64
  chars.
- Returns `{ id, name, nameCode, avatarColor, avatarUrl }[]` (the
  `search/authors` shape, so the list row is the same component).
- `Cache-Control: private, max-age=30`.
- Phase 2: optional `context={contentTypeId}:{rootId}` that puts thread
  participants first, and an empty `search` that returns only them.

### 2b. Current names: `GET /users/mentioned?ids=`

- Core `users` module, public (guests read posts too), `ids` 1–50 positive
  integers, deduped and sorted so the cache key is stable.
- Returns `{ id, name, nameCode }[]` for active members only; a missing id means
  deleted, and the renderer falls back to plain `@label`. Nothing private: the
  same fields as the public profile.
- `Cache-Control: public, max-age=300` plus the API cache keyed by the sorted
  ids, invalidated per user on rename / delete.
- Server-side twin `resolveMentionedUsers(c, ids)` (same query) for output with
  no browser: email (`richTextToHtml`) and RSS.

### 3. Mention targets (`@vitnode/api/mentions`)

```ts
export const defineMentionTarget = <TId extends number>(def: {
  id: string; // plugin-scoped, like reaction targets
  /** Members of `userIds` who may read the target now. Batched. */
  access: (args: { c: Context; id: TId; userIds: number[] }) => Promise<number[]>;
  /** Title and same-site URL for the notification, or null when gone. */
  preview: (args: { c: Context; id: TId }) => Promise<{ title: string; url: string } | null>;
}) => def;

/**
 * Make `core_mentions` mirror the mentions in `documents`: store and notify
 * new readers, retract removed ones. Idempotent.
 */
export const syncMentions = async (args: {
  c: Context;
  target: MentionTarget;
  id: number;
  actorId: number;
  documents: RichTextDocument[];
  exclude?: number[];
  tx?: Transaction;
}) => { /* see steps below */ };
```

`syncMentions` in one transaction:

1. Extract ids from `documents` (`richTextMentionsOf`), drop the actor and
   deleted members.
2. **Removed**: rows not in the text → delete, then
   `notifications.remove({ subject, userIds })`.
3. **New**: insert `ON CONFLICT DO NOTHING RETURNING id, user_id`.
4. If the actor's roles lack `allowMentions`, stop here (rows kept, nobody
   notified - if they gain it later, only mentions added after that notify).
5. Filter the new users through `target.access`, drop `exclude`, apply the cap,
   set `notified = true` and publish one `core.mention` event per user.
6. Emit `mention.created` / `mention.removed` after commit.

Registered through `buildApiPlugin({ mentionTargets })`; every content type with
at least one rich-text field not opted out gets
`contentMentionTarget(model, pluginId)`
automatically (access = `contentNotificationAccess({ policy: "content" })`,
preview = the same title/URL the reaction target uses).

### 4. Content Engine

- `mentions?: boolean` (default `true`) on `field.richText()` in
  `content/fields.ts`, with JSDoc saying it is on by default and how to opt
  out. Existing content types get mentions without a code change.
- New intent `recordContentMentions({ tx, contentTypeId, contentId, actorId })`
  in `notifications/intents.ts`, recorded inside the write transaction **only
  when a rich-text field with mentions changed or the record just became
  public** (a title-only edit records nothing):
  - `public-write-service.ts` create (L605) and update (L742), next to
    `assertRichTextFileOrigins`;
  - `editorial-service.ts` where first publication and published revisions are
    committed;
  - admin plain writes (`routes.ts` create/update) and `localized-admin-routes.ts`;
  - `schedule-effects.ts` (scheduled publish) and the moderation approval path
    (`recordContentModerationDecision` with an approved decision) - a record
    that was pending at save time is checked again when it goes public.
- `processContentMentionsIntent` in `process.ts`: reload under `FOR SHARE`,
  skip unless public, extract, exclude `threadReply` recipients, call
  `syncMentions` in one transaction.
- Delete: `recordContentNotificationCleanup` also deletes `core_mentions` rows
  of the record (the notifications themselves are detached by subject already).

### 5. Notification type `core.mention` (`lib/notifications/core-types.ts`)

```ts
export const mentionNotification = buildNotificationType({
  id: "core.mention",
  version: 1,
  category: "social",
  label: "core.notifications.types.mention.label",
  description: "core.notifications.types.mention.desc",
  schema: z.object({
    pluginId: z.string(),
    targetType: z.string(),
    targetId: z.number().int(),
    rootId: z.number().int().nullable(),
    title: z.string(),
    url: z.string().nullable(),
  }),
  defaults: { inApp: true, email: "immediate" },
  email: true,
  grouping: { key: ({ data }) => `${data.pluginId}:${data.targetType}:${data.rootId ?? data.targetId}`, windowMinutes: 60 },
  access: mentionTargetAccess, // groups by target, delegates to each target's access
  present: ({ actorCount, actors, data, t }) => ({
    title: t("core.notifications.types.mention.title", {
      count: actorCount,
      name: actors[0]?.name ?? t("core.notifications.someone"),
      title: data.title,
    }),
    target: data.url,
  }),
});
```

- Idempotency key `mention:{core_mentions.id}` (one event per new mention row,
  ≤ 10 per record). A retried worker reuses the row, so it can't notify twice;
  a mention removed and added back gets a new row, so it notifies again.
- Subject `{ type: "mention", id: "{pluginId}:{targetType}:{targetId}" }`, so
  retraction removes exactly this record's mention for the given users. Check
  in phase 3 that `remove()` on one event of a grouped inbox row recounts the
  group ("Anna and 2 others") instead of dropping the whole row.
- Copy in `packages/api/src/locales/en.json` (+ the other locales):
  - `title`: `{count, plural, one {{name} mentioned you in "{title}"} other {{name} and # others mentioned you in "{title}"}}`
  - `label`: "Mentions", `desc`: "When someone mentions you with @."
- The member settings page and the AdminCP **Notifications → Types** policy pick
  the type up automatically.

### 6. Events (`packages/api/src/events/mentions.ts`)

- `mention.created` - `{ pluginId, targetType, targetId, actorId, users:
  { id, notified }[] }`, emitted after commit for the newly stored mentions
  (also the ones over the cap or without access, with `notified: false`).
- `mention.removed` - `{ pluginId, targetType, targetId, actorId, userIds }`,
  emitted after commit when an edit removes mentions (their notifications are
  already retracted).
- Documented in `apps/web/content/docs/dev/events/built-in-events.mdx`.

## Front end

### Editor (`packages/vitnode/src/components/tiptap/mention/`)

- `mention-extension.ts` - `Mention.extend({ addAttributes: nameCode })`
  configured with `char: "@"`, `allowSpaces: false`,
  `deleteTriggerWithBackspace: true`, `renderText: "@" + label`, and a
  `suggestion` built like `emojiSuggestion`.
- `mention-suggestion.ts` - `items: ({ query }) =>
  queryClient.query(userMentionsQueryOptions(query))` with a 150 ms debounce;
  the `queryClient` comes from `useQueryClient()` in `TipTapEditor` through the
  extension options. Results are cached by query, so typing back and forth
  doesn't refetch.
- `mention-suggestion-list.tsx` - the popup (`SUGGESTION_POPUP_CLASS`):
  - row = `Avatar` (24px) + name + muted `@nameCode`, `role="option"`,
    keyboard ↑ ↓ Enter Tab Esc, `useActiveDescendant` on the editor;
  - loading: 3 skeleton rows of the same size, `aria-busy`, one sr-only
    `role="status"`;
  - empty query: hint row "Type a name" (phase 2: thread participants);
  - no match: "No members found";
  - error: inline message with `role="alert"` and a **Try again** button
    (`RotateCwIcon`) that refetches in place.
- In the editor the node renders as an inline chip (`text-primary
  font-medium`, `bg-primary/10`, rounded), not a link, so clicking it doesn't
  navigate away from a draft.
- `createTipTapExtensions({ mentions })` adds the node **always** (so existing
  mentions keep parsing and rendering in any editor) but the `@` suggestion
  only when `mentions` is on (the default), a user is signed in and one of
  their roles has `allowMentions` (read from the session's permissions, the
  same place `canReact` comes from).
- `AutoFormEditor` and `TipTapEditor` get `mentions?: boolean`, default `true`.
  No plugin changes needed: core comments, forum, blog, newsroom, ModCP and the
  AdminCP collaborative editor (atom nodes sync through Yjs as is) all get the
  popup. `mentions={false}` only where a field opts out on the server.
- Toolbar: no button; the slash menu gets **Mention someone** (inserts `@`).

### Rendering

- `richTextNodeElement` (`@vitnode/api/content/rich-text/elements.ts`):
  `case "mention"` → `<a href="/profile/{nameCode}" data-mention>@{name}</a>`,
  taking `name` / `nameCode` from an optional resolved map and falling back to
  the snapshot attrs.
- `RichTextContent` collects the mention ids of its document once (memoized
  `richTextMentionsOf`) and runs one `useQuery(mentionedUsersQueryOptions(ids))`
  (`GET /users/mentioned`, `staleTime` 5 min, no query when there are no
  mentions). Default `nodes.mention` → `<UserPreview nameCode={current}>` with
  `@{current name}`; snapshot while pending, plain `@label` text when the id is
  gone. A failed lookup keeps the snapshot - mentions are never blanked. Every
  existing caller (comments, forum, blog, newsroom, ModCP snapshots) gets this
  without changes.
- `richTextToHtml` takes the same resolved map from `resolveMentionedUsers`,
  so emails and RSS link to the current profile URL (absolute).
- `richTextToPlainText` → `@label` (excerpts, search index, notification
  bodies, audit diffs).

## AdminCP

- **Settings → Content**: "Notify up to N mentioned members per post"
  (`mentions.maxNotifiedPerItem`, default 10, 0 = no cap). Sheet + `AutoForm`,
  toast after save.
- **Roles → edit role**: a **Can mention members** switch (`allowMentions`) in
  the role's content permissions, saved with the role form. No daily limit.
- **Notifications → Types**: `core.mention` appears on its own.

## Docs

- `apps/web/content/docs/dev/mentions.mdx` - mentions are on by default,
  turning them off for a field (`field.richText({ mentions: false })` +
  `AutoFormEditor mentions={false}`), custom
  targets with `defineMentionTarget` / `syncMentions`, and what notifies when.
- Content Engine field reference: the `mentions` option.
- Member guide: mentioning someone and turning mention emails off.
- AdminCP guide (roles): the **Can mention members** switch.
- `built-in-events.mdx`: `mention.created`, `mention.removed`.
- JSDoc on `defineMentionTarget`, `syncMentions`, `richTextMentionsOf`, the
  `mentions` field option and the `mentions` editor prop.

## Phases

1. **Node + rendering** - `@tiptap/extension-mention`, `richTextMentionsOf`,
   render cases (React, HTML, email, plain text), `UserPreview` in
   `RichTextContent`.
2. **Suggestions + current names** - `GET /users/mentions`,
   `GET /users/mentioned` + `resolveMentionedUsers`, indexes, popup with
   skeleton/empty/error states, `mentions` prop (default `true`) on the
   editors, `core_roles.allowMentions` + role switch.
3. **Storage + notifications** - `core_mentions` + migration,
   `defineMentionTarget`, `syncMentions` (add, notify, retract),
   `core.mention` type, `mention.created` / `mention.removed` events, cap
   setting.
4. **Content Engine** - `field.richText({ mentions })`, `contentMentionTarget`,
   `recordContentMentions` at every write path, worker, delete cleanup + cron,
   `threadReply` de-duplication. Comments, forum topics, blog posts and
   newsroom content get it with no plugin change.
5. **Docs**.
6. **Later** - thread participants first in the popup, a "Mentions" filter in
   the notification inbox, a mentions tab on the profile timeline.

Tests (separate session, after it works): `richTextMentionsOf` (dedupe, order,
invalid attrs), the renderer (bad `nameCode`/`id` → plain text, renamed
member → current name and link, deleted member → plain text, failed lookup →
snapshot), `GET /users/mentions` (401 for guests, 403 without
`allowMentions`, ordering, banned/deleted skipped, limit),
`GET /users/mentioned` (id limits, deleted ids missing), `syncMentions` (new
vs existing rows, cap counts only readers, self, idempotent retry, actor
without `allowMentions` notifies nobody, removed mention retracts, removed and
re-added notifies again), the CE worker (draft / pending / hidden / unreadable
recipient notify nobody, edit notifies only new members, approval later
notifies, reply authors not notified twice, localized fields), and the
suggestion list (keyboard, select inserts a node, error retry).

## Decided

- **Renamed members** → links resolve by `id` (`GET /users/mentioned`); no
  nameCode history.
- **Permission** → role switch `allowMentions`, no daily limit.
- **Default email** → `immediate`.
- **Removing a mention** → retracts its notification.
- **Popup and access** → the popup suggests everyone; only members who can
  read the record are notified.

## Open questions

- **Block / ignore.** VitNode has no ignore feature. When it lands, ignored
  members should be filtered in `syncMentions` (and probably hidden from the
  popup).
