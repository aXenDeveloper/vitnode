# Reactions and reputation

Status: implemented (all phases). Owner: core (`@vitnode/api` + `@vitnode/core`).

## Implemented differently from this plan

- **Event names** are singular, like `role.*`: `reaction.added`, `reaction.removed`,
  `reaction.changed`, `reaction.catalog_changed`, `reputation.changed`.
- **No server-side coalescing** of live messages: every write publishes once
  (writes are already capped by the global `write` rate limit), writes to one
  target are serialized with an advisory lock so `seq` follows commit order,
  and the browser keeps the highest `seq`.
- **No shared server cache for counts**: summaries read the denormalized
  `core_reactions_counts` rows directly (primary-key lookups); the catalog and
  its role rules are cached.
- **Reaction form** opens in a wide Sheet (like report reasons), not a Dialog,
  because `AutoFormSheetFooter` needs a Sheet.
- **Role settings** are saved by the role form through
  `PUT /admin/reactions/roles/{roleId}` (the same way the AI tab saves), and
  `GET /admin/reactions/roles/0` returns a new role's defaults.
- **Member settings** live at `GET/PUT /reactions/me/settings` and the
  reputation summary at `GET /reactions/reputation/{userId}`; the merged
  timeline is `GET /users/{userId}/timeline`.
- **Timeline previews** come from the search index, falling back to the
  record's own title and delivery URL for types without search.
- A **daily cron** (`reactions-cleanup`) removes reactions of records deleted
  by a database cascade and recounts the reputation they gave.
- The guest role gets `allowReact = false`; every role gets
  `maxReactionsPerItem = 1`.

Reputation badge - decided from /proto/reputation:

- Direction: tinted pill, no icon: "+1.2K reputation".
- Color by sign with the theme tokens: `--success` tint above zero,
  `--destructive` below, `bg-muted` at zero; the text uses
  `FEEDBACK_TONE_TEXT`. The sign is always spelled out (`signDisplay:
  "exceptZero"`), so color is never the only signal.
- Large values shortened with the new `ShortNumber` UI component (compact
  notation, full number in a tooltip and for screen readers).
- Rejected: the plain muted pill (no direction at a glance), the inline trend
  text (too easy to miss in the meta row) and the boxed stat (too much weight
  for a secondary number, and it drops below the name on mobile). The trophy
  icon was dropped as decoration that did not explain itself.

Who reacted - decided from two /proto/who-reacted rounds:

- Direction: a hover card on every reaction pill (`ReactionPeek`). It names the
  first 5 people who gave that reaction and links to the full list
  (**See all N**, or **See all reactions** when other reactions exist), which
  opens the who-reacted sheet filtered to that reaction. Names load when the
  card opens and share the sheet's query cache.
- The card's footer says what a click on the pill does ("Click to react",
  "Click to remove yours", "Sign in to react"). Opens after 350 ms, closes
  after 150 ms.
- A pill the viewer can't press (their own item, a reaction their role can't
  use) still opens the filtered list on click, which also covers touch.
- Rejected in round 1: the icon-only people button, the "See who reacted" link
  in the picker, counts only (authors want to know who), and a face pile with
  "You and 41 others" (too busy, long names truncate). Rejected in round 2: a
  split pill whose number opens the list (two small touch targets), long press
  or right click (nobody finds it) and a "Reacted" tab in the picker (the list
  hides behind the add button and is cramped for 40+ names).
- Known limit: hover cards don't open on touch, so members who can react reach
  the full list only from their own items there.

Docs: `content-engine/reactions`, `dev/reactions/*` and the reaction events in
`dev/events/built-in-events`.

## Goals

1. **One reactions system for everything.** Members react to an article, a
   comment, a forum topic, or anything a plugin owns that is not a Content
   Engine type (a correction notice, a chat message, a profile status).
2. **Content Engine types opt in with one line**: `reactions: true` on
   `defineContentType`, the same way `reports: true` works today.
3. **AdminCP owns the catalog.** Admins add, reorder, rename and disable
   reactions. A reaction is an **emoji**, a **Lucide icon** or an **uploaded
   image** (PNG, JPEG, WebP or animated GIF), has a translated title,
   **reputation points**, and the **roles allowed to use it**.
4. **Roles decide who reacts and how much.** Each role has a **Reactions**
   tab: allow reacting, a total daily limit, and a daily limit **for each
   reaction** - every limit with an **Unlimited** option.
5. **Reputation.** Every reaction is worth points (`+1`, `0`, `-1`, ...). The
   author of the target collects them; the total shows on the profile and
   next to the author's name in comments.
6. **Timeline.** Reactions a user gives appear in their profile timeline,
   mixed with the content they wrote ("Anna reacted ❤️ to _Budget vote
   tonight_").
7. **Fast threads, shared cache.** A page of 50 comments reads all reactions
   in one request; public counts stay cacheable, the viewer's own reaction is
   asked in the browser, like `/permissions` already is.
8. **Several reactions per item, capped by role.** The system always
   supports several different reactions from one user on one item
   (Slack-style). Each role sets **Max reactions per item** - `1` by
   default, any number, or Unlimited. Nothing to configure in code.
9. **Live.** When the WebSocket is available, counts update on screen as
   other people react. Without it (serverless, socket off) everything still
   works over HTTP.

Non-goals (first version): a "most reacted" feed, reputation levels/badges,
reactions on AdminCP-only records.

## The pattern we copy: reports

Reports already solve "a core feature on top of anything a plugin owns":

| Reports today                                                                                            | Reactions                                                                                     |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `defineReportTarget({ type, parseId, capture, current, ... })` in `lib/moderation/targets.ts`            | `defineReactionTarget({ type, parseId, access, preview, ... })` in `lib/reactions/targets.ts` |
| `buildApiPlugin({ moderation: { reportTargets } })`                                                      | `buildApiPlugin({ reactions: { targets } })`                                                  |
| `reports: true` on a content type → `contentReportTarget(model, pluginId)` registered in `lib/plugin.ts` | `reactions: true` → `contentReactionTarget(model, pluginId)` registered next to it            |
| `core_moderation_reports (pluginId, targetType, targetId)`                                               | `core_reactions_entries (pluginId, targetType, targetId)`                                     |
| `ContentTarget` + `contentTarget()` from `@vitnode/core/content`                                         | the **same** `ContentTarget` - no new identity type                                           |
| `canReport` in `ContentViewerPermissions`                                                                | `canReact` next to it                                                                         |
| `report: id => contentTarget(...)` in `useContentComments`                                               | `reactions: id => contentTarget(...)`                                                         |
| `<ReportButton target={...} />`                                                                          | `<ReactionBar target={...} />`                                                                |
| Reasons: `core_moderation_report_reasons` + `core_languages_words`                                       | Catalog: `core_reactions` + `core_languages_words`                                            |

A target is always the triple `{ pluginId, type, id }`. The core never knows
whether it points at a Content Engine row or a hand-written table.

## Decisions

| Topic                           | Decision                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reactions per user per item     | Always several-capable. The cap is the role setting `maxReactionsPerItem` (default `1`, `null` = unlimited, otherwise `1..50`), the most generous of the user's roles. No `reactions` block in `buildApiConfig`, no per-target option.                                                                                                                                                                            |
| At the cap                      | Cap `1`: picking another reaction **replaces** the current one (the familiar one-click switch). Cap `2+`: the picker disables reactions the user has not used on this item ("Remove one to pick another") and the server answers `409 item_limit`. Removing is always allowed.                                                                                                                                    |
| Lowering the cap later          | Existing extra reactions stay and still count. A user over the new cap can only remove until under it - except at cap `1`, where a new pick replaces all of theirs on that item. No migration either way.                                                                                                                                                                                                         |
| Negative points                 | Allowed, `-100..100`. Reputation can go below zero.                                                                                                                                                                                                                                                                                                                                                               |
| Live refresh                    | A core WebSocket channel `reactions/live`. The browser joins one room per target **on screen**; every write pushes the new public counts to that room. No socket → no live, plain HTTP.                                                                                                                                                                                                                           |
| Which reactions a target offers | **Every enabled reaction** the viewer's roles may use. No per-target list - the AdminCP is the only place that narrows it.                                                                                                                                                                                                                                                                                        |
| Reaction look                   | `kind`: `emoji` (`👍`), `icon` (Lucide name) or `image` (an uploaded file). Emoji and icon reuse the existing `EmojiIconPicker` and its `emoji:` / `icon:` serialization (`@vitnode/api/lib/emoji-icon`).                                                                                                                                                                                                         |
| Uploads                         | PNG, JPEG, WebP, GIF (animated allowed); max 512 KB; no SVG (it can carry script). Stored in `core_files` (folder `reactions`). `sharp` (already a dependency) checks the real type, caps it at 256×256 and writes a static first-frame poster of animated images for `prefers-reduced-motion`.                                                                                                                   |
| Role access: reacting at all    | New role column `allowReact` (default `true`, `false` for the guest role) + `reactionsPerDay` (total over all reactions, `null` = unlimited), in a new **Reactions** tab of the role form. Like every permission, any of the user's primary or secondary roles grants it.                                                                                                                                         |
| Role access: each reaction      | `core_reactions_roles (reactionId, roleId, dailyLimit)` - one row per role that may use the reaction, with its own daily limit (`null` = unlimited, `0` is not allowed - leave the role out instead). `core_reactions.allRoles = true` lets every role in, unlimited, except roles that have a row, which get that row's limit. Same "deleted role closes, never opens" rule as `core_content_access_rule_roles`. |
| Several roles                   | The most generous wins, for every limit: any role with `null` → unlimited, otherwise the highest number. Same as every other permission counting primary + secondary roles.                                                                                                                                                                                                                                       |
| Three limits at once            | All are checked: reactions per item (`maxReactionsPerItem`), the daily role total (`reactionsPerDay`) and the reaction's own daily limit. E.g. Members: 1 per item, 50 a day in total, of which at most 5 `disagree` and 10 `party-parrot`; VIP: 3 per item, unlimited everything else.                                                                                                                           |
| What counts toward a limit      | Reactions the user **gave today** (midnight in the user's time zone, `core_users.timeZone`, UTC without one) that still exist. Removing one frees the slot; a replace at cap `1` counts the new one only. Toggle spam is stopped by the per-minute rate limit, not the daily limit.                                                                                                                               |
| Staff                           | Limits apply to staff too - they're member settings. A root role is not a bypass; give the role `null` instead.                                                                                                                                                                                                                                                                                                   |
| Reputation                      | `core_reactions.points` (`-100..100`, negative allowed, default `1` for `like`). The target's author gets the points; `core_users.reputation` is a denormalized total updated in the reaction's transaction, and may be negative. Self reactions (when allowed) never count. A target can opt out (`reputation: false`).                                                                                          |
| Changing points                 | Retroactive: saving a new `points` value queues `core.reactions.recount_reputation`, which recomputes the totals of every author who received that reaction.                                                                                                                                                                                                                                                      |
| Timeline                        | A new merged `GET /users/{userId}/timeline` returns the content a user wrote (search index, as today) **and** the reactions they gave, newest first, with one opaque cursor. The profile switches to it; the search-only `/search/timeline/{userId}` stays for search consumers.                                                                                                                                  |
| Timeline privacy                | A reaction appears only when the viewer can read its target (resolved through the target's `access`), and only while the user keeps the new privacy setting `showReactionsOnProfile` (default `true`). The AdminCP user timeline shows everything.                                                                                                                                                                |
| Who can see counts              | Anyone who can read the target. An unreadable target answers as if it had no reactions - never reveal that a draft exists.                                                                                                                                                                                                                                                                                        |
| Hidden content                  | Hidden = unreadable for members, so no reacting; counts and reputation are kept and come back on unhide.                                                                                                                                                                                                                                                                                                          |
| Deleted target                  | Entries, counts and the reputation they gave are removed by the target's deletion effects (automatic for Content Engine; `deleteReactions()` helper for custom targets).                                                                                                                                                                                                                                          |
| Deleted user                    | `userId` `on delete cascade` + a task that recounts the affected targets and authors.                                                                                                                                                                                                                                                                                                                             |
| Disabled reaction               | Hidden from the picker, summaries and timeline; rows and reputation kept. Deleting a reaction cascades its rows and recounts reputation.                                                                                                                                                                                                                                                                          |
| Transport                       | One core module `reactions` for every target, batch reads by `ids`. No per-content-type routes.                                                                                                                                                                                                                                                                                                                   |
| Events                          | `reactions.added`, `reactions.removed`, `reactions.changed`, `reputation.changed`.                                                                                                                                                                                                                                                                                                                                |
| Notifications                   | Optional notification type `core.reaction_received`, batched ("Anna and 4 others reacted to your comment"). Phase 5.                                                                                                                                                                                                                                                                                              |

## Data model

### `packages/api/src/database/reactions.ts`

```ts
import { sql } from "drizzle-orm";
import {
  camelCase,
  check,
  index,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import { core_files } from "./files";
import { core_roles } from "./roles";
import { core_users } from "./users";

export const REACTION_KINDS = ["emoji", "icon", "image"] as const;

/** The catalog admins manage. Titles live in `core_languages_words`. */
export const core_reactions = camelCase.table.withRLS(
  "core_reactions",
  t => ({
    id: t.serial().primaryKey(),
    code: t.varchar({ length: 32 }).notNull().unique(), // "like", "party-parrot"
    kind: t.varchar({ enum: REACTION_KINDS, length: 10 }).notNull(),
    // `emoji:👍` or `icon:heart` - the EmojiIconPicker serialization. Null for `image`.
    icon: t.varchar({ length: 100 }),
    fileId: t
      .integer()
      .references(() => core_files.id, { onDelete: "restrict" }),
    // Static first frame of an animated upload, for reduced motion.
    posterFileId: t
      .integer()
      .references(() => core_files.id, { onDelete: "set null" }),
    points: t.integer().notNull().default(0),
    allRoles: t.boolean().notNull().default(true),
    enabled: t.boolean().notNull().default(true),
    position: t.integer().notNull().default(0),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    check(
      "core_reactions_kind_value",
      sql`(${t.kind} = 'image') = (${t.fileId} is not null) and (${t.kind} = 'image') = (${t.icon} is null)`,
    ),
    check("core_reactions_points_range", sql`${t.points} between -100 and 100`),
  ],
);

/**
 * A role's access to one reaction and its daily limit (`null` = unlimited).
 * With `allRoles = false` only these roles may use the reaction; with
 * `allRoles = true` every role may, and a row only sets that role's limit.
 */
export const core_reactions_roles = camelCase.table.withRLS(
  "core_reactions_roles",
  t => ({
    reactionId: t
      .integer()
      .notNull()
      .references(() => core_reactions.id, { onDelete: "cascade" }),
    roleId: t
      .integer()
      .notNull()
      .references(() => core_roles.id, { onDelete: "cascade" }),
    dailyLimit: t.integer(),
  }),
  t => [
    primaryKey({ columns: [t.reactionId, t.roleId] }),
    index("core_reactions_roles_role_id_idx").on(t.roleId),
    check(
      "core_reactions_roles_daily_limit_positive",
      sql`${t.dailyLimit} is null or ${t.dailyLimit} between 1 and 100000`,
    ),
  ],
);

/** One user's reaction to one target. */
export const core_reactions_entries = camelCase.table.withRLS(
  "core_reactions_entries",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    targetType: t.varchar({ length: 100 }).notNull(),
    targetId: t.varchar({ length: 64 }).notNull(),
    reactionId: t
      .integer()
      .notNull()
      .references(() => core_reactions.id, { onDelete: "cascade" }),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    // Who received it: reputation, notifications, "reactions received".
    // Null for self reactions and targets with `reputation: false`.
    targetAuthorId: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    unique("core_reactions_entries_unique").on(
      t.pluginId,
      t.targetType,
      t.targetId,
      t.userId,
      t.reactionId,
    ),
    // The user's timeline, newest first; also the role total for today.
    index("core_reactions_entries_user_timeline_idx").on(
      t.userId,
      t.createdAt,
      t.id,
    ),
    // Today's count of one reaction for the per-reaction limit.
    index("core_reactions_entries_user_reaction_idx").on(
      t.userId,
      t.reactionId,
      t.createdAt,
    ),
    index("core_reactions_entries_list_idx").on(
      t.pluginId,
      t.targetType,
      t.targetId,
      t.reactionId,
      t.createdAt,
    ),
    index("core_reactions_entries_author_idx").on(
      t.targetAuthorId,
      t.reactionId,
    ),
  ],
);

/** Denormalized counts, written in the same transaction as the entry. */
export const core_reactions_counts = camelCase.table.withRLS(
  "core_reactions_counts",
  t => ({
    pluginId: t.varchar({ length: 100 }).notNull(),
    targetType: t.varchar({ length: 100 }).notNull(),
    targetId: t.varchar({ length: 64 }).notNull(),
    reactionId: t
      .integer()
      .notNull()
      .references(() => core_reactions.id, { onDelete: "cascade" }),
    count: t.integer().notNull().default(0),
    // `nextval('core_reactions_counts_version_seq')` on every upsert. A
    // target's live `seq` is the max over its rows, so it only ever grows.
    version: t.bigint({ mode: "number" }).notNull(),
  }),
  t => [
    primaryKey({
      columns: [t.pluginId, t.targetType, t.targetId, t.reactionId],
    }),
  ],
);
```

### Changes to existing tables

```ts
// database/roles.ts - core_roles
allowReact: t.boolean().notNull().default(true),
reactionsPerDay: t.integer(), // total over all reactions; null = unlimited (default)
maxReactionsPerItem: t.integer().default(1), // per user per item; null = unlimited

// database/users.ts - core_users
reputation: t.integer().notNull().default(0),
showReactionsOnProfile: t.boolean().notNull().default(true),
// + index("core_users_reputation_idx").on(t.reputation) for a future leaderboard
```

The migration sets `allowReact = false` on the guest role and
`maxReactionsPerItem = 1` on every role. The per-item cap is enforced in the
service, inside the write's transaction, so one unique index serves every
cap and changing a role needs no migration.

Seed:

| code       | kind  | icon               | points |
| ---------- | ----- | ------------------ | ------ |
| `like`     | emoji | `emoji:👍`         | 1      |
| `love`     | emoji | `emoji:❤️`         | 1      |
| `haha`     | emoji | `emoji:😂`         | 1      |
| `wow`      | emoji | `emoji:😮`         | 1      |
| `sad`      | emoji | `emoji:😢`         | 0      |
| `thanks`   | icon  | `icon:hand-heart`  | 2      |
| `disagree` | icon  | `icon:thumbs-down` | -1     |

## Permissions: who may use which reaction

```ts
// packages/api/src/lib/reactions/permissions.ts

/** What the current user may do, resolved once per request and cached per role set. */
export interface ReactionViewerPolicy {
  /** Signed in + any role with `allowReact` + not suspended. */
  canReact: boolean;
  /** Role total per day, the most generous of the user's roles; `null` = unlimited. */
  totalPerDay: null | number;
  /** Different reactions on one item, the most generous of the user's roles; `null` = unlimited. */
  maxPerItem: null | number;
  /**
   * Usable reactions and each one's daily limit for this user (`null` =
   * unlimited). A reaction missing from the map is not usable.
   */
  reactions: Map<number, { dailyLimit: null | number }>;
}

/** Resolves one reaction's limit for a set of roles. */
const limitFor = (
  reaction: { allRoles: boolean; roles: Map<number, null | number> },
  roleIds: number[],
): { dailyLimit: null | number } | undefined => {
  const limits = roleIds.flatMap(roleId =>
    reaction.roles.has(roleId)
      ? [reaction.roles.get(roleId) ?? null]
      : reaction.allRoles
        ? [null] // a role without a row on an "all roles" reaction is unlimited
        : [],
  );
  if (limits.length === 0) return undefined;

  return {
    dailyLimit: limits.includes(null)
      ? null
      : Math.max(...(limits as number[])),
  };
};
```

Usage for today is one query per request that needs it:

```sql
select reaction_id, count(*) from core_reactions_entries
where user_id = $1 and created_at >= $startOfUserDay
group by reaction_id
```

The total is the sum of those rows. `PUT /reactions` re-reads it inside the
write transaction, after locking the user's row (`select … for update` on
`core_users`), so two parallel clicks cannot both take the last slot.

- Resolved from all the user's roles (primary + secondary). A root role does
  not bypass it - reacting is a member setting, not a staff permission.
- Cached in `c.get("cache")` keyed by the sorted role ids, dropped when a role
  or the catalog changes.
- A suspended user (moderation sanctions) gets `canReact: false`.
- `GET /reactions/catalog` returns every enabled reaction plus, for the
  viewer, `usable` and `remainingToday` (`null` = unlimited), and top-level
  `maxPerItem` and `remainingToday` (role total). The picker hides what the viewer
  cannot use, shows "3 left today" on limited reactions, and disables a
  reaction (with the reason in its tooltip) once its limit is used up, while
  counts still show reactions others gave.
- `PUT /reactions` re-checks all of it: `403 reacting_disabled`,
  `403 reaction_not_allowed`, `409 item_limit` (cap `2+` reached on this
  item), `429 daily_limit` (role total) or
  `429 reaction_daily_limit` (this reaction), both with `resetsAt`, the next
  midnight in the user's time zone. Removing a reaction is never limited.

## Reputation

- Each entry's value is `reaction.points` - not a copy - so a points change
  in the AdminCP is retroactive through the recount task.
- In the reaction's transaction: `update core_users set reputation =
  reputation + :delta where id = :targetAuthorId` (delta = new points - old
  points when a cap-`1` pick replaces the previous reaction).
- `reputation.changed` is emitted after commit (`userId`, `delta`, `total`,
  `reason: "reaction" | "recount"`).
- Recount task `core.reactions.recount_reputation({ userIds? | reactionId? })`:
  `sum(points)` over `core_reactions_entries join core_reactions where
  targetAuthorId in (...)`, batched by 500 users. Runs after a points change,
  a reaction deletion, a deleted reacting user, or "Recount" in the AdminCP.
- Shown: profile header (`reputation` on `GET /users/{id}/profile`), the
  author line of comments (`ContentComments` already renders the author; the
  thread's `people` hydration adds `reputation`), the AdminCP user detail.
- A `reputation: false` target (e.g. a chat message) still has reactions but
  never moves reputation (`targetAuthorId` stays null).

## Server API

### 1. Custom target (`@vitnode/api/reactions`)

```ts
// packages/api/src/lib/reactions/targets.ts

/** What a target says about each id, for the current visitor. */
export interface ReactionTargetAccess {
  /** The visitor can read the target; `false` hides its reactions entirely. */
  canRead: boolean;
  /** Who wrote it: blocks self reactions and collects reputation. */
  authorId: null | number;
  /** `true` freezes reactions (a locked topic, an archived article). */
  locked?: boolean;
}

/** How a reaction's target looks in a user's timeline. */
export interface ReactionTargetPreview {
  /** Plain text, max 200 characters. */
  title: string;
  url: string;
  /** i18n key naming the kind of thing ("comment", "article"), an ICU plural called with `count: 1`. */
  label: string;
}

/**
 * Something members can react to that is not a Content Engine type (those
 * register their target automatically with `reactions: true`). Register it in
 * `buildApiPlugin({ reactions: { targets } })`.
 */
export interface ReactionTargetDefinition {
  /** Stable id stored with every reaction, e.g. `"newsroom.correction"`. */
  type: string;
  /** Validates a client-sent id before anything reads it; `null` rejects it. */
  parseId: (value: string) => null | string;
  /**
   * Access for a batch of parsed ids, as the current visitor. A missing id is
   * treated as unreadable. Called once per request, never per id.
   */
  access: (
    c: Context,
    args: { ids: string[] },
  ) => Promise<Map<string, ReactionTargetAccess>>;
  /**
   * Title and link for the timeline, for ids `access` already allowed.
   * Without it, reactions to this target never appear in timelines.
   */
  preview?: (
    c: Context,
    args: { ids: string[] },
  ) => Promise<Map<string, ReactionTargetPreview>>;
  /** Authors may react to their own target. Default `false`; never earns reputation. */
  selfReact?: boolean;
  /** Reactions move the author's reputation. Default `true`. */
  reputation?: boolean;
}

export const defineReactionTarget = (
  definition: ReactionTargetDefinition,
): ReactionTargetDefinition => {
  /* validate `type` with MODERATION_IDENTIFIER_PATTERN, like defineReportTarget */
  return definition;
};

/** Purges every reaction of the given ids and takes back their reputation. Call it from your delete path. */
export const deleteReactions: (
  c: Context,
  target: { pluginId: string; type: string; ids: string[] },
) => Promise<void>;
```

Example - reactions on newsroom corrections (a hand-written table, not Content
Engine):

```ts
// plugins/newsroom/src/api/lib/reactions.ts
import { defineReactionTarget } from "@vitnode/api/reactions";
import { eq, inArray } from "drizzle-orm";

import { newsroom_articles } from "@/database/articles";
import { newsroom_corrections } from "@/database/corrections";

const readCorrections = async (c: Context, ids: string[]) =>
  await c
    .get("db")
    .select({
      id: newsroom_corrections.id,
      body: newsroom_corrections.body,
      createdById: newsroom_corrections.createdById,
      articleSlug: newsroom_articles.slug,
    })
    .from(newsroom_corrections)
    .innerJoin(
      newsroom_articles,
      eq(newsroom_articles.id, newsroom_corrections.articleId),
    )
    .where(inArray(newsroom_corrections.id, ids.map(Number)));

export const correctionReactionTarget = defineReactionTarget({
  type: "newsroom.correction",
  // Editors file corrections as part of their job - no reputation for them.
  reputation: false,
  parseId: value => (/^[1-9]\d{0,9}$/.test(value) ? value : null),
  access: async (c, { ids }) =>
    new Map(
      (await readCorrections(c, ids)).map(row => [
        String(row.id),
        { canRead: true, authorId: row.createdById },
      ]),
    ),
  preview: async (c, { ids }) =>
    new Map(
      (await readCorrections(c, ids)).map(row => [
        String(row.id),
        {
          title: row.body.slice(0, 200),
          url: `/news/${row.articleSlug}#corrections`,
          label: "newsroom.corrections.label",
        },
      ]),
    ),
});

// plugins/newsroom/src/config.api.ts
buildApiPlugin({
  manifest,
  reactions: { targets: [correctionReactionTarget] },
  // ...
});
```

### 2. Content Engine target (`reactions` on `defineContentType`)

```ts
// plugins/newsroom/src/content/article.ts
export const articleContentType = defineContentType({
  id: "newsroom.article",
  // ...
  reports: true,
  reactions: true, // the cap per item comes from the user's roles; earns reputation
});

// plugins/newsroom/src/content/comment.ts
export const commentContentType = defineContentType({
  id: "newsroom.comment",
  // ...
  reports: { titleField: "body", snapshotFields: ["body"] },
  reactions: { selfReact: false },
  thread: { parent: "parent", root: "article", maxDepth: COMMENT_MAX_DEPTH },
});
```

`content/define-reactions.ts` → `resolveReactions(id, input, { publicApi,
fields })`, modelled on `resolveReports`:

- `true | { selfReact, reputation }`; unknown keys throw a
  `ContentEngineError` (so a leftover `allow` or `mode` fails loudly and
  points to the role setting **Max reactions per item**).
- Requires `publicApi` ("members react to what they can read, and the public
  API decides that").
- `selfReact` and `reputation` need an ownership field
  (`publicWrite.ownership` or a single `field.user()`); without one,
  `reputation` resolves to `false` and `selfReact: true` throws.

`content/server/reaction-target.ts` → `contentReactionTarget(model, pluginId)`:

- `parseId` → `parseContentId(definition.idStrategy, value)` + `contentIdKey`.
- `access` → one `select … where id in (…)` on the base table, the
  public-reachability check the public service uses (published, not hidden,
  `contentRecordAccessFlags(...).canRead` for container policies), author from
  `contentAuthorIds`. Hidden records are unreadable unless
  `canViewHiddenContentRecord`, and even then `locked: true`.
- `preview` → `core_search_index` rows for `itemType = definition.id`,
  `itemId in (…)` in the viewer's language (title + url are already there),
  label from `contentI18nKeys(definition, pluginId).label`. Types without
  search fall back to the admin `titleField` and `contentDeliveryPublicUrl`.
- Registered in `lib/plugin.ts` right after `reportTargets`:

```ts
const reactionTargets: ReactionTargetDefinition[] = [
  ...(reactions?.targets ?? []),
  ...contentModels
    .filter(model => contentDefinitionOf(model).reactions.enabled)
    .map(model => contentReactionTarget(model, pluginId)),
];
```

- Delete effects (`write-effects.ts`) call `deleteReactions` for the deleted
  ids; cascades from a deleted article reach comments through the same path.
- `resolveContentViewerPermissions` adds
  `canReact: definition.reactions.enabled && isPublic && (!isOwner || selfReact)`
  (guests get `true`, like `canReport`, so the button can ask them to sign in;
  role and per-reaction checks come from the catalog's `usable`).

### 3. HTTP routes

All target routes take the target as `pluginId` + `type` + `id(s)`, exactly
like `POST /moderation/reports`.

| Method              | Path                         | Who                    | What                                                                                          |
| ------------------- | ---------------------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| `GET`               | `/reactions/catalog`         | anyone                 | Enabled reactions with `usable` for the viewer. Shared part cached; `Cache-Control: private`. |
| `GET`               | `/reactions`                 | anyone                 | Summaries for up to 100 ids: counts per code + the viewer's own codes + `canReact`.           |
| `PUT`               | `/reactions`                 | signed in              | Add a reaction (at cap `1` it replaces the previous one). Idempotent.                         |
| `DELETE`            | `/reactions`                 | signed in              | Remove one reaction (or all of the viewer's with no `reaction`). Idempotent.                  |
| `GET`               | `/reactions/users`           | anyone who can read    | Who reacted, cursor-paginated, filterable by `reaction`.                                      |
| `GET`               | `/users/{userId}/timeline`   | anyone                 | Merged timeline: content written + reactions given.                                           |
| `GET`               | `/users/{userId}/reputation` | anyone                 | Total + reactions received per code (profile card).                                           |
| `GET`               | `/admin/reactions`           | staff `can_view`       | Catalog with usage count, points, roles.                                                      |
| `POST/PATCH/DELETE` | `/admin/reactions…`          | staff `can_manage`     | Create, edit, delete. Delete answers how many reactions and how much reputation it removes.   |
| `PUT`               | `/admin/reactions/order`     | staff `can_manage`     | Reorder.                                                                                      |
| `POST`              | `/admin/reactions/recount`   | staff `can_manage`     | Queue a full reputation recount.                                                              |
| `GET`               | `/admin/users/{id}/timeline` | staff `users.can_view` | Existing route, now with reactions too.                                                       |

Request/response shapes:

```ts
// GET /reactions/catalog
{
  "live": true, // the WebSocket is mounted - the client may join rooms
  "maxPerItem": 1, // the viewer's cap per item; null = unlimited
  "remainingToday": 41, // role total; null = unlimited
  "resetsAt": "2026-11-19T00:00:00.000+01:00",
  "items": [
    { "code": "like", "kind": "emoji", "icon": "emoji:👍", "image": null, "title": "core.reactions.like", "points": 1, "usable": true, "remainingToday": null },
    { "code": "thanks", "kind": "icon", "icon": "icon:hand-heart", "image": null, "title": "core.reactions.thanks", "points": 2, "usable": true, "remainingToday": null },
    { "code": "disagree", "kind": "icon", "icon": "icon:thumbs-down", "image": null, "title": "core.reactions.disagree", "points": -1, "usable": true, "remainingToday": 3 },
    {
      "code": "party-parrot",
      "kind": "image",
      "icon": null,
      "image": { "url": "/files/reactions/party-parrot.gif", "posterUrl": "/files/reactions/party-parrot.png", "width": 64, "height": 64, "animated": true },
      "title": "core.reactions.party-parrot",
      "points": 1,
      "usable": false,
      "remainingToday": 0
    }
  ]
}
```

```ts
// GET /reactions?pluginId=@vitnode/newsroom&type=newsroom.comment&ids=12,13,14
const summariesQuery = z.object({
  pluginId: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
  ids: z.string().min(1).max(2000), // comma separated, max 100 after parsing
});

// 200
{
  "items": [
    {
      "id": "12",
      "total": 7,
      "counts": [{ "code": "like", "count": 5 }, { "code": "party-parrot", "count": 2 }],
      "viewer": ["like"],
      "canReact": true
    },
    { "id": "13", "total": 0, "counts": [], "viewer": [], "canReact": false }
  ]
}
```

```ts
// PUT /reactions
const reactBody = z.object({
  pluginId: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
  id: z.string().min(1).max(64),
  reaction: z.string().min(1).max(32),
});
// 200 → the target's summary (the client replaces its cache)
// 401
// 403 reacting_disabled (no role allows it) | reaction_not_allowed (roles of this reaction)
//     self_reaction | locked
// 409 item_limit (cap 2+ reached on this item; never at cap 1, which replaces)
// 404 not_found (unknown target type, bad id, disabled reaction, or the visitor cannot read it)
// 429 daily_limit | reaction_daily_limit  → { error, resetsAt }
// 429 rate_limited                        → Retry-After header

// DELETE /reactions  (body: same as PUT, `reaction` optional) → 200 summary
```

```ts
// GET /users/42/timeline?first=20&cursor=…&lang=en
{
  "edges": [
    {
      "kind": "reaction",
      "createdAt": "2026-11-18T09:12:00.000Z",
      "reaction": { "code": "love", "kind": "emoji", "icon": "emoji:❤️", "image": null, "title": "core.reactions.love" },
      "target": {
        "pluginId": "@vitnode/newsroom",
        "type": "newsroom.comment",
        "id": "12",
        "label": "newsroom.content.comment.label",
        "title": "Great point about the budget vote…",
        "url": "/news/comments/c-12"
      }
    },
    {
      "kind": "content",
      "createdAt": "2026-11-17T18:40:00.000Z",
      "item": { /* the existing search hit, unchanged */ }
    }
  ],
  "pageInfo": { "hasNextPage": true, "endCursor": "eyJzIjo0MSwiciI6OTF9" }
}
```

The timeline route reads `first` rows from each source after its own cursor
(search hits after `s`, reactions after `r` by `(createdAt, id)`), filters
reactions through each target's `access` + `preview` in batches per target
type, merges by date, keeps `first`, and encodes both positions in one opaque
cursor. When an unreadable reaction is dropped the page is topped up, so a
private profile does not page through blanks.

### 4. Service (`packages/api/src/lib/reactions/service.ts`)

```ts
const summary = await db.transaction(async tx => {
  // 1. policy: allowReact, reaction usable by the user's roles;
  //    lock the user row, then today's usage vs the role total and the reaction's limit
  // 2. the user's reactions on this target vs policy.maxPerItem:
  //    - under the cap → keep them
  //    - cap 1 → remove the others, decrement their counts, take back their points
  //    - cap 2+ reached → 409 item_limit
  // 3. insert into core_reactions_entries … on conflict do nothing
  // 4. if inserted: upsert core_reactions_counts set count = count + 1
  // 5. if targetAuthorId: update core_users set reputation = reputation + delta
  // 6. read the target's counts back (one indexed read on core_reactions_counts)
});
// after commit:
//   cache.drop(target)
//   publishReactionCounts(c, target, summary)   // live, see below
//   events.emit(reactionsAddedEvent / reactionsChangedEvent)
//   events.emit(reputationChangedEvent) when delta ≠ 0
```

Daily limits count the user's entries since midnight in their time zone
(`core_users.timeZone`); the `user_timeline` and `user_reaction` indexes
cover both queries. Rate limit: `REACTIONS_LIMITS.perUserPerMinute = 60`
through the existing rate-limiter. The policy (roles → limits) is cached; the
usage (today's counts) is never cached, it is read in the transaction.

### 5. Events (`packages/api/src/events/reactions.ts`)

```ts
const reactionPayload = z.object({
  pluginId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  targetAuthorId: z.number().int().nullable(),
  reaction: z.string(),
  points: z.number().int(),
  userId: z.number().int(),
});

export const reactionsAddedEvent = defineEvent({
  pluginId,
  name: "reactions.added",
  payload: reactionPayload,
});
export const reactionsRemovedEvent = defineEvent({
  pluginId,
  name: "reactions.removed",
  payload: reactionPayload,
});
export const reactionsChangedEvent = defineEvent({
  pluginId,
  name: "reactions.changed",
  payload: reactionPayload.extend({ previousReaction: z.string() }),
});
export const reputationChangedEvent = defineEvent({
  pluginId,
  name: "reputation.changed",
  payload: z.object({
    userId: z.number().int(),
    delta: z.number().int(),
    total: z.number().int(),
    reason: z.enum(["reaction", "recount"]),
  }),
});
```

All documented in `apps/web/content/docs/dev/events/built-in-events.mdx`.

### 6. Live refresh (`packages/api/src/reactions/live.ts` + `lib/reactions/live/server.ts`)

Built the same way as the Content Engine live refresh
(`content/live/refresh.ts`, `content/server/refresh/*`): a channel on the
shared `/api/ws` socket, rooms in the WebSocket registry, `realtime.toRoom`
to publish, Redis relay across instances, the Durable Object hub on
Cloudflare. Nothing new in the transport.

```ts
// packages/api/src/reactions/live.ts - browser-safe
export interface ReactionsLiveTarget {
  pluginId: string;
  type: string;
  id: string;
}

export interface ReactionsLiveClientMessage {
  clientId: string;
  type: "join" | "leave";
  /** Up to 50 targets of one plugin + type per message. */
  pluginId: string;
  targetType: string;
  ids: string[];
}

export type ReactionsLiveServerMessage =
  | { clientId: string; type: "joined"; rooms: string[]; refused: string[] }
  | {
      clientId: string;
      type: "error";
      code: "INVALID_MESSAGE" | "RATE_LIMITED" | "TOO_MANY_SUBSCRIPTIONS";
    }
  | { room: string; type: "revoked" }
  | {
      room: string;
      type: "counts";
      /** Monotonic per target; a receiver ignores anything older than what it has. */
      seq: number;
      total: number;
      counts: { code: string; count: number }[];
    };

export const reactionsLiveChannel = createWebSocketChannel<
  ReactionsLiveClientMessage,
  ReactionsLiveServerMessage
>({ pluginId: "@vitnode/core", module: "reactions", id: "live" });

/** `reactions:{pluginId}:{type}:{id}` - a routing key, never a permission. */
export const reactionsLiveRoom = (target: ReactionsLiveTarget): string =>
  `reactions:${target.pluginId}:${target.type}:${target.id}`;

export const REACTIONS_LIVE_MAX_SUBSCRIPTIONS = 200; // per connection, all tabs
export const REACTIONS_LIVE_MAX_JOINS_PER_MINUTE = 300;
export const REACTIONS_LIVE_REAUTH_MS = 60_000;
export const REACTIONS_LIVE_BATCH_MS = 250; // server coalesces bursts per room
```

**Joining.** The server parses every id with the target's `parseId` and
runs the target's `access` once for the whole batch, as the socket's user
(guests included - counts are public to readers). Readable ids are joined;
the rest come back in `refused`, with no reason, so a draft is
indistinguishable from a missing row. A target type nobody registered is
refused the same way.

**Re-checking.** Like the content refresh, every membership is re-checked
every `REACTIONS_LIVE_REAUTH_MS` (one batched `access` per target type per
socket), so a record that was hidden, deleted or moved behind a container
policy stops streaming within a minute; the member gets `revoked`. Hide and
delete effects of Content Engine types, and `deleteReactions`, also send
`revoked` to the room straight away.

**Publishing.** After a write commits, `publishReactionCounts` sends the new
public counts to the target's room. Unlike content refresh signals, this
message **carries the values**: counts are identical for every reader of the
target (they passed `access` to join), and a popular thread would otherwise
turn each click into one `GET` per open tab. What stays out of the message:
who reacted, and the viewer's own reactions - those only change through the
viewer's own requests. `seq` is the highest `version` among the target's
rows in `core_reactions_counts` (every upsert takes the next value of one
Postgres sequence), read back in the write's transaction, so out-of-order
deliveries across instances are dropped. A removal still bumps it: the
decremented row keeps its place with a new `version` (rows at `0` are swept
by a daily cron).

Bursts (a viral post) are coalesced per room for `REACTIONS_LIVE_BATCH_MS`
on the instance that wrote, so a room sees at most four messages a second.

**The viewer's other tabs.** `realtime.sendToUser(userId, reactionsLiveChannel, …)`
with the same counts plus `viewer` would leak nothing, but is not worth a
second message shape: the other tab's count updates from the room, and its
`viewer` state is refetched when the tab regains focus.

**When it is off.** `isWebSocketEnabled()` false (serverless, no socket
mounted) or a client without a connection: nothing is published or joined;
the UI refetches on window focus and after its own writes, as any query
does. The catalog's `live` flag (from `isWebSocketEnabled()`, not a setting)
tells the client whether to try.

## Front end (`@vitnode/core/tanstack/reactions`)

```tsx
import {
  ReactionBar,
  ReactionIcon,
  Reputation,
} from "@vitnode/core/tanstack/reactions";
```

- `reactionsCatalogQueryOptions()` - the catalog; per viewer, kept for the
  session.
- `useReactions(target)` - one target's summary. Calls in the same tick are
  coalesced (`lib/coalesce.ts`) into one `GET /reactions?ids=…` per
  `pluginId`+`type`, so 50 comments make one request.
- `useToggleReaction(target)` - optimistic `onMutate` (with the catalog's
  `maxPerItem` of `1` a new pick replaces the old one; otherwise it toggles
  just that one, and unused reactions are disabled in the picker once the
  cap is reached), rollback + `sonner` toast with a description on
  error (`item_limit` asks to remove one first; `daily_limit` /
  `reaction_daily_limit` say when it resets, in the
  user's time), `invalidateQueries` on settle - including the catalog, so
  `remainingToday` stays right.
- `useReactionsLive(target)` - used inside `ReactionBar`. Does nothing when
  `useOptionalVitNodeWebSocketContext()` is `null` or the catalog says
  `live: false`. Otherwise an `IntersectionObserver` joins the target's room
  while it is on screen (with a 200 px margin) and leaves when it scrolls
  away; joins and leaves from every bar on the page are coalesced into one
  message per `pluginId`+`type` per tick. A `counts` message writes
  `total`/`counts` straight into the summary in the query cache with
  `setQueryData` (no refetch), keeps `viewer`, and drops messages with an
  older `seq`. On reconnect it rejoins the visible rooms and refetches their
  summaries once, since nothing is replayed. `revoked` refetches the summary
  (which then answers "no reactions, can't react"). A pending optimistic
  write wins over a live message until it settles.
- Live changes are not announced to screen readers one by one (that would
  be noise in a busy thread); each pill's `aria-label` carries the current
  count, and the changing number gets `motion-safe:` a short opacity/scale
  tick only.
- `<ReactionIcon reaction={…} />` - one renderer for all three kinds:
  `EmojiIcon` (existing) for emoji and Lucide icons, `<img>` for uploads with
  `width`/`height`, `loading="lazy"` and `alt=""` (the button carries the
  label). Animated uploads render as a `<picture>` whose
  `(prefers-reduced-motion: reduce)` source is the static poster.
- `<ReactionBar target={…} />` - pills with counts plus a picker
  (`Popover`) listing only `usable` reactions. Each pill is a
  `<button aria-pressed>` labelled "Like, 5 reactions, you reacted"; the
  picker button has a `SmilePlusIcon` (`aria-hidden`). Guests open the
  sign-in dialog; a role without `allowReact` sees counts only. A "who
  reacted" `Sheet`, lazy-loaded, opens from the total. Skeleton while
  `isPending`; `Empty` with retry if the first load fails; pills disabled
  with `aria-busy` while a write is pending.
- `<Reputation value={…} />` - a compact badge (`TrophyIcon` + number,
  `aria-label` "Reputation: 128"), negative values in `text-destructive`.

Article page (beside `ReportButton`):

```tsx
// plugins/newsroom/src/pages/article-page.tsx
import { contentTarget } from "@vitnode/core/content";
import { ReactionBar } from "@vitnode/core/tanstack/reactions";

<ReactionBar
  target={contentTarget(manifest.id, articleContentType, item.id)}
/>;
```

Comments - one new option on `useContentComments`, mirroring `report`; the
comment item renders `<ReactionBar>` in its footer, `<Reputation>` next to
the author, and the hook batches every visible id:

```tsx
// plugins/newsroom/src/pages/article-comments.tsx
const comments = useContentComments({
  ...articleCommentsThread(articleId),
  // ...
  report: id => contentTarget(manifest.id, commentContentType, id),
  reactions: id => contentTarget(manifest.id, commentContentType, id),
});
```

Custom target - same component, a hand-built `ContentTarget`:

```tsx
<ReactionBar
  target={{
    pluginId: manifest.id,
    type: "newsroom.correction",
    id: String(correction.id),
  }}
/>
```

Profile:

- Header: `<Reputation>` + a "Reactions received" row (top codes with
  counts) from `GET /users/{id}/reputation`.
- Timeline (`views/profile`): `profileTimelineQueryOptions` switches to
  `GET /users/{userId}/timeline`; a `kind: "reaction"` row is one line -
  avatar, "reacted <ReactionIcon> to a comment: _title_" linking to the
  target, relative time. `FeedPendingSkeleton` covers both kinds.
- Settings → Privacy: switch "Show my reactions on my profile".

Raw calls (what the hooks do under the hood):

```ts
import { fetcher } from "@vitnode/core/tanstack/fetcher";

const summaries = await fetcher({
  plugin: "@vitnode/core",
  method: "get",
  module: "reactions",
  path: "/",
  args: {
    query: {
      pluginId: manifest.id,
      type: commentContentType.id,
      ids: "12,13,14",
    },
  },
});

await fetcher({
  plugin: "@vitnode/core",
  method: "put",
  module: "reactions",
  path: "/",
  args: {
    body: {
      pluginId: manifest.id,
      type: commentContentType.id,
      id: "12",
      reaction: "love",
    },
  },
});

const timeline = await fetcher({
  plugin: "@vitnode/core",
  method: "get",
  module: "users",
  path: "/{userId}/timeline",
  args: { params: { userId: "42" }, query: { first: "20" } },
});
```

## AdminCP

### Settings → Reactions (`/admin/core/settings/reactions`)

- A short note above the table: "How many reactions a member can give one
  item is set per role", linking to Roles, and whether live updates are on.
- Sortable table (drag to reorder): icon preview, title, code, points
  (negative in `text-destructive`), roles ("All roles" or role badges),
  enabled switch, usage count.
- **Dialog** (several sections, lazy-loaded form) for create/edit, built with
  `AutoForm`:
  - **Look**: `AutoFormRadioGroup` _Emoji / Icon / Upload_.
    - Emoji → `AutoFormEmojiIcon` with `allow={["emoji"]}`.
    - Icon → `AutoFormEmojiIcon` with `allow={["icon"]}`.
    - Upload → `AutoFormFile` (`accept="image/png,image/jpeg,image/webp,image/gif"`,
      512 KB), with a live preview at 20 px and 32 px, and an "Animated"
      badge for GIFs.
  - **Details**: code, translated title (`AutoFormMultiLang`), enabled.
  - **Reputation**: points (`AutoFormNumber`, -100..100, negative allowed)
    with a hint that changes apply to past reactions and trigger a recount.
  - **Permissions & limits**: switch "All roles", then a table with one row
    per role:
    - "Can use" checkbox (always on and read-only while "All roles" is on),
    - "Per day" - `AutoFormNullableNumber` with `toggleLabel="Unlimited"`
      (checked by default, `null`), `min={1}`, `unitLabel="per day"`,
      disabled when "Can use" is off.

    Saving writes a `core_reactions_roles` row for each role that can use it
    with a limit, and - when "All roles" is off - for each unlimited role too.
    A short summary under the table reads it back in words ("Members: 5 a
    day · Moderators, VIP: unlimited · Guests: no").
- Delete through `ConfirmAction`, showing how many reactions and how much
  reputation it removes. Table refresh + toast with a description after every
  write. **Recount reputation** button (queues the task, toast).
- Staff permissions: new `reactions` admin module with `can_view` and
  `can_manage`.

### Roles → edit role → **Reactions** tab

Next to the existing _General / Content / Profile / AI_ tabs in
`role-form-content.tsx`:

- `allowReact` - switch "Can react".
- `maxReactionsPerItem` - `AutoFormNullableNumber` "Max reactions per
  item" (`min={1}`, `max={50}`, default `1`, `toggleLabel="Unlimited"`),
  with the hint "At 1, picking another reaction replaces the current one."
  Shown only when `allowReact` is on.
- `reactionsPerDay` - `AutoFormNullableNumber` "Reactions per day in total"
  with `toggleLabel="Unlimited"` (default), shown only when `allowReact` is
  on.
- **Per reaction** - the same matrix seen from the role's side: one row per
  reaction (icon, title, points) with "Can use" and "Per day"
  (`AutoFormNullableNumber`, `toggleLabel="Unlimited"`). It reads and writes
  the same `core_reactions_roles` rows as the reaction dialog, so an admin
  can set limits either per reaction or per role. Rows of "All roles"
  reactions show "Can use" checked and locked; only their limit is editable.
- Saved with the role through `PATCH /admin/roles/{id}` (new
  `reactions: { reactionId, dailyLimit }[]` field), in one transaction, with
  the policy cache dropped afterwards.

### Users → user detail

- Reputation shown in the summary card.
- The existing timeline tab shows reactions too.

## Phases

1. **Core** - tables + role/user columns + migration + seed, catalog with emoji/icon/upload
   (`sharp` validation + posters), role & per-reaction policy,
   `defineReactionTarget`, registry in `buildApiPlugin`,
   `GET/PUT/DELETE /reactions`, events, `deleteReactions`.
2. **Reputation** - points in the service, `core_users.reputation`, recount
   task, `GET /users/{id}/reputation`, `reputation.changed`.
3. **Content Engine** - `reactions` option + validation,
   `contentReactionTarget` (access + preview), delete effects, `canReact` in
   `/permissions`, `reputation` in the thread's `people` hydration.
4. **Live** - `reactions/live` channel, join/leave with batched `access`,
   re-check sweep, `publishReactionCounts` with per-room coalescing and
   `seq`, `revoked` from hide/delete effects.
5. **UI** - `@vitnode/core/tanstack/reactions` (`ReactionBar`,
   `ReactionIcon`, `Reputation`, hooks incl. `useReactionsLive`,
   who-reacted sheet),
   `useContentComments({ reactions })`, merged profile timeline + privacy
   switch, AdminCP reactions page, role **Reactions** tab, user detail;
   wire newsroom articles + comments, blog posts + comments, forum topics +
   comments.
6. **Extras** - `core.reaction_received` notification, reputation
   leaderboard widget.
7. **Docs** - `dev/reactions.mdx` (custom targets, live), the `reactions`
   option in the Content Engine
   reference, AdminCP guides (reactions, roles, reputation), events list.

Tests (separate session, after it works): the service (per-item cap `1`
replaces, cap `2+` answers `409`, unlimited, leftovers after lowering a cap,
most generous cap across roles, idempotency, counts,
reputation deltas on add/switch/remove, negative totals), live (join refuses
unreadable ids without saying why, re-check revokes, `seq` ordering, nothing
published with the socket off), the policy
(role `allowReact`, per-reaction roles across secondary roles, most generous
limit wins, `allRoles` rows as limit overrides, role total and per-reaction
limits at once, parallel clicks on the last slot, user time zone midnight),
the routes (401/403/404/429, unreadable ids leak nothing), the timeline
merge and cursor, upload validation (SVG and disguised files rejected, GIF
poster), `resolveReactions` validation, `contentReactionTarget` access for
hidden/draft/policy-restricted records, and `ReactionBar` toggle + optimistic
rollback.

## Open questions

- Should a role need a minimum reputation to use some reactions (e.g. the
  GIFs)? Easy to add as `core_reactions.minReputation` later.
- Should limits also exist per **target** (e.g. at most 3 `disagree` on the
  same author per day), to stop one user pushing another's reputation down?
  Per-reaction daily limits already slow it; a per-author cap would be a
  second query on `targetAuthorId`.
