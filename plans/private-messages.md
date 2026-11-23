# Private messages

Status: planned. Owner: core (`@vitnode/api` + `@vitnode/core`).

## Goals

1. **Members talk privately.** A member starts a conversation with one
   person or a small group, from the header, a profile or the user preview
   card. Messages are rich text with images and attachments, like comments.
2. **One inbox, one unread count.** A **Messages** button next to the
   notification bell shows how many conversations have unread messages and
   opens the latest ones. `/messages` is the full inbox.
3. **Live when possible, fine without it.** With the WebSocket, new messages,
   edits, read receipts and "typing…" arrive instantly. Without it (serverless,
   socket off) everything works over HTTP with polling of the open
   conversation.
4. **Members stay in control.** Who may message me, a block list, mute,
   archive and leave. A blocked member can't start a conversation with you
   or add you to one.
5. **Roles decide who messages and how much.** A **Messages** tab in the role
   form: allow messaging, max recipients, new conversations per day.
6. **Safe by default.** Messages are reportable through the existing
   moderation reports; moderators see only what was reported. Suspended
   members are locked out (the global middleware already treats them as
   guests). New conversations are rate limited and capped per day.
7. **GDPR from day one.** Messages join the member's data export and the
   account erasure through `definePersonalData`.
8. **Notifications and email** reuse the notifications system: a member who
   doesn't read a message in time gets an email (immediate or in the digest),
   one per conversation, not one per message.

Non-goals (first version): end-to-end encryption, voice/video, message
reactions (the reactions system can add a `conversation_message` target
later), plugin-defined message embeds, staff browsing of conversations that
nobody reported, scheduled messages, message forwarding.

## Naming

- UI: **Messages** (Polish: _Wiadomości_). A thread is a **conversation**.
- Code and API: `conversations` / `messages`. Module `messages` under the
  `@vitnode/core` plugin id: `fetcher({ plugin: "@vitnode/core", module:
"messages", ... })`.
- Tables: `core_conversations`, `core_conversations_participants`,
  `core_conversations_messages`, plus `core_users_blocks`.

Add **Conversation**, **Participant** and **Block** to `CONTEXT.md`.

## Decisions

| Topic                        | Decision                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct vs group              | `kind: "direct"` (exactly 2 people) or `"group"` (2..`maxRecipients + 1`). A direct conversation is unique per pair: starting one with someone you already talk to opens the existing one (`directKey = "<minId>:<maxId>"`, unique). Adding a third person to a direct conversation starts a **new group** with no history copied - nobody's past messages leak to a newcomer.           |
| Group history                | Someone added to a group sees messages from the moment they were added (`participants.firstVisibleMessageId`). Re-added after leaving: from the new join.                                                                                                                                                                                                                                 |
| Group roles                  | The creator is the **owner**: rename, add, remove. Everyone else is a **member**: add people only when the owner allows it (`membersCanInvite`, default `false`). When the owner leaves, the longest-standing member becomes owner.                                                                                                                                                       |
| Hard cap                     | A group never exceeds 50 participants (AdminCP setting `maxParticipants`, `2..200`) whatever the roles say. Messaging is for small talks, not broadcasts.                                                                                                                                                                                                                                  |
| Who may message me           | User setting `messagesFrom`: `everyone` (default) or `nobody`. `nobody` still lets staff in (see Staff). A block always wins, also over `everyone`. Checked when starting a conversation and when adding someone - existing conversations stay readable.                                                                                                                                  |
| Blocking                     | A new generic table `core_users_blocks (userId, blockedUserId)`. In messaging it means: they can't start a conversation with you or add you to a group, and their new messages in a **direct** conversation are refused (`403 blocked`). In a group both stay; the UI collapses the blocked person's messages behind "Message from a blocked member - show". Max 1000 blocks per member. |
| Staff                        | Moderators with the new moderator permission `messages.can_message_anyone` may start a conversation with members who chose `nobody` or blocked them (warnings, support). Admins and moderators have **no** permission to read conversations - only reported messages, through the existing ModCP report view.                                                                            |
| Content                      | `RichTextDocument` (TipTap JSON), validated with `createRichTextDocumentSchema({ maxBytes })`. Default limit 20 KB, AdminCP setting `maxMessageBytes`. Empty documents are refused. No headings or embeds - the composer uses the comment editor preset.                                                                                                                                  |
| Attachments                  | Uploaded with the editor upload flow (`lib/editor-uploads.ts`) into a new private folder `messages`. Only participants who can see the message can download the file: a new access check in the file download route, same shape as Content Engine private files. Upload rights follow the role's existing `allowUploadFiles` / `maxStorageForSubmit`.                                   |
| Editing and deleting         | The author may edit or delete a message within `editWindowMinutes` (AdminCP setting, default 15, `0` = never, `null` = always). An edited message shows **Edited**; a deleted one leaves a tombstone ("Message deleted") so replies keep their context. No edit history in v1.                                                                                                            |
| Leaving and "delete"         | A member can't delete a conversation for everyone. **Leave** (group) removes them and posts a system message. **Delete for me** (direct) hides the conversation until a new message arrives. When every participant has left or deleted it, a daily cron removes the conversation, its messages and its files.                                                                          |
| Read state                   | One cursor per participant: `lastReadMessageId`. Unread = the conversation's `lastMessageId > lastReadMessageId`. Opening a conversation moves the cursor to the newest visible message.                                                                                                                                                                                                  |
| Read receipts                | Shown: **Seen** under your last message in a direct conversation, **Seen by Anna, Piotr +2** in a group. User setting `showReadReceipts` (default `true`), symmetric: turn it off and you don't see others' either.                                                                                                                                                                       |
| Typing indicator             | WebSocket only, never stored. The browser sends `typing` at most every 3 s while the composer changes; the server relays it to the other participants' sockets; it expires after 6 s. Hidden for blocked members and for members who turned off `showReadReceipts` (same privacy switch).                                                                                               |
| Unread badge                 | Counts **conversations** with unread messages, not messages; shown as `99+` above 99. Muted and archived conversations don't count.                                                                                                                                                                                                                                                      |
| Mute and archive             | Per participant. **Mute** (`mutedUntil`, 8 h / 1 week / forever) stops notifications and the badge. **Archive** moves it to the Archived tab until a new message arrives.                                                                                                                                                                                                                |
| Notifications                | A notification type `core.conversation_message`, category `messages`, defaults `{ inApp: false, email: "immediate" }` - the Messages button is the in-app channel, so the bell stays for everything else. Grouped by conversation. The fan-out runs after a delay (see Notifications), so a message read within 2 minutes sends no email.                                              |
| Suspended members            | Locked out: the global middleware sets `user = null` for a suspended session, so every messages route answers `401` like for a guest - no extra check. Their conversations stay for the other participants. Open question: should others see a "can't reply right now" note? |
| Deleted members              | On erasure their participant rows go away and their messages keep their content with `authorId = null`, shown as **Deleted member** (the content belongs to the other side's conversation too). Their uploads are deleted.                                                                                                                                                               |
| Guests                       | Never. The guest role gets `allowMessages = false` and the routes require a user session.                                                                                                                                                                                                                                                                                                 |
| Message ids and pagination   | `bigserial` ids; a page is "50 messages before id X" (cursor), newest first, so infinite scroll upward never skips or repeats while new messages arrive.                                                                                                                                                                                                                                  |
| Search                       | Participant-only search inside your own conversations, with a `tsvector` column on the messages table - never in `core_search_index`, which is built for public and access-scoped content.                                                                                                                                                                                               |

## Data model

### `packages/api/src/database/messages.ts`

```ts
export const core_conversations = camelCase.table.withRLS(
  "core_conversations",
  t => ({
    id: t.serial().primaryKey(),
    kind: t.varchar({ enum: ["direct", "group"], length: 16 }).notNull(),
    /** `"<minUserId>:<maxUserId>"` for direct conversations, `null` for groups. */
    directKey: t.varchar({ length: 32 }).unique(),
    title: t.varchar({ length: 100 }),
    createdById: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    membersCanInvite: t.boolean().notNull().default(false),
    lastMessageId: t.bigint({ mode: "number" }),
    lastMessageAt: t.timestamp(),
    participantsCount: t.integer().notNull().default(0),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [index("core_conversations_last_message_at_idx").on(t.lastMessageAt)],
);

export const core_conversations_participants = camelCase.table.withRLS(
  "core_conversations_participants",
  t => ({
    conversationId: t
      .integer()
      .notNull()
      .references(() => core_conversations.id, { onDelete: "cascade" }),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    role: t.varchar({ enum: ["owner", "member"], length: 16 }).notNull(),
    joinedAt: t.timestamp().notNull().defaultNow(),
    /** Set when the member left or was removed; the row stays for history. */
    leftAt: t.timestamp(),
    /** Direct conversations: hidden until a newer message than this. */
    hiddenUntilMessageId: t.bigint({ mode: "number" }),
    firstVisibleMessageId: t.bigint({ mode: "number" }).notNull().default(0),
    lastReadMessageId: t.bigint({ mode: "number" }).notNull().default(0),
    lastReadAt: t.timestamp(),
    mutedUntil: t.timestamp(),
    archivedAt: t.timestamp(),
  }),
  t => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    // Inbox: my active conversations, newest first.
    index("core_conversations_participants_inbox_idx").on(
      t.userId,
      t.leftAt,
      t.archivedAt,
    ),
  ],
);

export const core_conversations_messages = camelCase.table.withRLS(
  "core_conversations_messages",
  t => ({
    id: t.bigserial({ mode: "number" }).primaryKey(),
    conversationId: t
      .integer()
      .notNull()
      .references(() => core_conversations.id, { onDelete: "cascade" }),
    authorId: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    kind: t.varchar({ enum: ["message", "system"], length: 16 }).notNull(),
    content: t.jsonb().$type<RichTextDocument>(),
    /** System messages: `{ type: "joined" | "left" | "removed" | "renamed", ... }`. */
    system: t.jsonb().$type<ConversationSystemEvent>(),
    /** Idempotency of a send: the browser's id for the optimistic message. */
    clientId: t.varchar({ length: 64 }),
    searchVector: t.customType<{ data: string }>({ dataType: () => "tsvector" })(),
    createdAt: t.timestamp().notNull().defaultNow(),
    editedAt: t.timestamp(),
    deletedAt: t.timestamp(),
  }),
  t => [
    index("core_conversations_messages_page_idx").on(t.conversationId, t.id),
    index("core_conversations_messages_author_idx").on(t.authorId),
    unique("core_conversations_messages_client_key").on(
      t.authorId,
      t.clientId,
    ),
    index("core_conversations_messages_search_idx").using(
      "gin",
      t.searchVector,
    ),
  ],
);

export const core_users_blocks = camelCase.table.withRLS(
  "core_users_blocks",
  t => ({
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    blockedUserId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    primaryKey({ columns: [t.userId, t.blockedUserId] }),
    index("core_users_blocks_blocked_idx").on(t.blockedUserId),
    check("core_users_blocks_not_self", sql`${t.userId} <> ${t.blockedUserId}`),
  ],
);
```

Files attached to a message are tracked like editor uploads in content:
`core_conversations_messages_files (messageId, fileId)` so the download
check and the cleanup cron find them with one query.

### Changes to existing tables

- `core_roles`: `allowMessages boolean default true` (`false` for the guest
  role in the migration), `messagesMaxRecipients integer default 5` (`null`
  = up to the hard cap), `conversationsPerDay integer default 20` (`null` =
  unlimited).
- `core_users`: `messagesFrom varchar(16) default 'everyone'`,
  `showReadReceipts boolean default true`.
- Relations in `database/relations.ts`.

Several roles: the most generous wins (any `true`, any `null`, otherwise the
highest number), as with reactions.

## Server API (`packages/api/src/modules/messages`)

Every route requires a user session (`requireUser`), answers
`Cache-Control: private, no-store` and is counted by the `write` / `read`
rate limits per user. A participant check sits in one helper,
`loadParticipant(c, conversationId)`, that answers `404` (never `403`) for
conversations you're not in, so ids can't be probed.

| Method   | Path                                     | What                                                                                                                                                                                                                            |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/messages/state`                        | `{ unreadConversations, lastMessageId }` for the header badge.                                                                                                                                                                  |
| `GET`    | `/messages`                              | Inbox page: `?filter=inbox\|unread\|archived&cursor=&q=`. Each row: title (or the other person), last message preview (plain text, 140 chars), unread flag, muted, participants preview (max 4 avatars).                        |
| `POST`   | `/messages`                              | Start: `{ recipientIds, title?, content, clientId }`. Direct with an existing pair → appends to it and returns its id (`200`), otherwise `201`. Checks role, daily limit, recipients cap, `messagesFrom`, blocks. |
| `GET`    | `/messages/{conversationId}`             | Conversation header: title, kind, participants (with `lastReadMessageId` when receipts are on), my settings, `canInvite`, `canWrite`.                                                                                           |
| `GET`    | `/messages/{conversationId}/messages`    | `?before=<id>&limit=50` (max 100). Newest first.                                                                                                                                                                                |
| `POST`   | `/messages/{conversationId}/messages`    | Send `{ content, clientId }`. Same `clientId` again returns the stored message (retries are safe).                                                                                                                              |
| `PATCH`  | `/messages/{conversationId}/messages/{id}` | Edit within the window.                                                                                                                                                                                                       |
| `DELETE` | `/messages/{conversationId}/messages/{id}` | Delete within the window (tombstone).                                                                                                                                                                                         |
| `POST`   | `/messages/{conversationId}/read`        | `{ messageId }` moves the cursor forward only.                                                                                                                                                                                  |
| `PATCH`  | `/messages/{conversationId}`             | Owner: `title`, `membersCanInvite`. Anyone: `mutedUntil`, `archived`.                                                                                                                                                           |
| `POST`   | `/messages/{conversationId}/participants` | Add `{ userIds }` (group only).                                                                                                                                                                                                |
| `DELETE` | `/messages/{conversationId}/participants/{userId}` | Owner removes someone; your own id = leave / delete for me.                                                                                                                                                           |
| `GET`    | `/messages/search`                       | `?q=` over your visible messages, 20 per page.                                                                                                                                                                                  |
| `GET`    | `/messages/settings`, `PUT` same         | `messagesFrom`, `showReadReceipts`.                                                                                                                                                                                             |
| `GET`    | `/users/blocks`, `PUT /users/blocks/{userId}`, `DELETE` same | The block list (generic, under `users`).                                                                                                                                                  |
| `GET`    | `/messages/can-message/{userId}`         | `{ allowed, reason }` so a profile can show or disable **Message** without trying.                                                                                                                                              |

Error codes (`HTTPException` with a stable `code`): `not_allowed` (role),
`daily_limit`, `too_many_recipients`, `recipient_unavailable` (deleted,
`nobody`, blocked - one code on purpose, so a member can't learn they were
blocked), `blocked` (writing in a direct conversation to someone you
blocked), `edit_window`, `group_full`.

### Service (`packages/api/src/lib/messages/service.ts`)

Routes stay thin; the service owns the rules so the WebSocket handler and
future plugin calls share them:

- `startConversation`, `sendMessage`, `editMessage`, `deleteMessage`,
  `markRead`, `addParticipants`, `removeParticipant`.
- Each write runs in one transaction: insert the message, update
  `core_conversations.lastMessageId/At`, clear `hiddenUntilMessageId` and
  `archivedAt` for the other participants, move the sender's read cursor.
  Writes to one conversation take `pg_advisory_xact_lock(conversationId)` so
  ids follow commit order (same trick as reactions).
- After commit: realtime push, notification publish, events, cache
  invalidation of each recipient's `messages:state:<userId>`.

### Events (`packages/api/src/events/messages.ts`)

`conversation.created`, `conversation.participant_added`,
`conversation.participant_removed` (with `reason: "left" | "removed"`),
`conversation.message_created`, `conversation.message_updated`,
`conversation.message_deleted`, `user.blocked`, `user.unblocked`.
Payloads carry ids only, never content. Document them in
`apps/web/content/docs/dev/events/built-in-events.mdx`.

### Notifications

Register `core.conversation_message` in core's notification types:

- `category: "messages"`, `defaults: { inApp: false, email: "immediate" }`,
  `subjectType: "core.conversation"`, grouping by conversation id, so one
  inbox item and one email per conversation ("3 new messages from Anna").
- `access` drops recipients who left, muted the conversation or already read
  past the message - checked again before the email is sent.
- The publish is delayed: `sendMessage` enqueues a queue task
  (`core_queue`, `availableAt = now + 2 min`, dedupe key per conversation and
  recipient) that publishes only if the recipient's cursor is still behind.
  No email for a conversation you're reading right now.
- The email links to `/messages/<id>` and never includes the message text -
  a forwarded or leaked email doesn't leak the conversation.

### Realtime (`packages/api/src/lib/messages/live`)

A channel `messages/live` on the existing registry. No rooms: recipients are
known, so the server pushes with `c.get("realtime").sendToUsers()` to every
active participant:

```ts
type MessagesLiveServerMessage =
  | { type: "message"; conversationId: number; message: ConversationMessage }
  | { type: "message_updated"; conversationId: number; message: ConversationMessage }
  | { type: "message_deleted"; conversationId: number; messageId: number }
  | { type: "read"; conversationId: number; userId: number; messageId: number }
  | { type: "typing"; conversationId: number; userId: number }
  | { type: "conversation"; conversationId: number } // header changed: refetch
  | { type: "state"; unreadConversations: number };
```

The client sends only `{ type: "typing", conversationId }`. The server
checks participation (cached for 60 s per socket, like reactions re-auth),
throttles to one relay per 3 s per user and conversation, and drops it for
blocked pairs. Messages for a revoked session stop through the existing
`closeUserConnections`.

### Moderation

Register a report target with `defineReportTarget` (type
`conversation_message`, permission module `messages`):

- `capture` snapshots the reported message **plus up to 5 messages before
  it** from the same conversation as read-only context, as rich-text fields.
  The reporter must be a participant who can see the message.
- Actions: `hide` (moderator permission `messages.can_hide`) replaces the
  message with "Hidden by a moderator" for everyone.
- `resolveAuthors` returns the author, so a warning can be issued from the
  report like for comments.

New moderator permissions in `coreStaffPermissions.moderator`:
`messages: ["can_hide", "can_message_anyone"]`.

### GDPR (`definePersonalData` in `lib/account-deletion/core-personal-data.ts`)

- **Export**: the member's own messages (conversation id, date, plain text,
  file names), the titles of conversations they are in, their block list and
  messaging settings. Other people's messages are not exported - they're the
  other people's data.
- **Erase**: delete participant rows and blocks (cascade), set `authorId =
  null` on their messages (the FK already does it), delete their message
  files, then delete conversations left with no active participant.

### Cron

`messages-cleanup` (daily): delete conversations where every participant
left or hid them and nothing new arrived for 7 days, with their files; drop
`core_conversations_messages_files` rows of deleted messages after the edit
window.

## Front end (`@vitnode/core/tanstack/messages`)

Routes are topology only; screens, queries and namespaces live in
`@vitnode/core/tanstack/messages`, following the notifications screen.

| Route                       | Screen                                                                                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/messages`                 | Inbox. Mobile: the list. `md` and up: list on the left, "Pick a conversation" empty state on the right.                                                                                                                             |
| `/messages/$conversationId` | Mobile: the conversation full screen with a back button. `md` and up: list + conversation side by side (the list stays mounted with `<Activity>` so its scroll and filters survive).                                               |
| `/messages/new`             | `?to=<userId>` preselects a recipient. Recipient picker (user search, chips, max = role cap), optional title for 2+ recipients, the composer. Sending navigates to the conversation.                                                 |
| `/settings/messages`        | New settings nav item: who may message me, read receipts, the block list (with unblock), and a link to the email preference for `core.conversation_message`.                                                                       |

Breadcrumbs through `staticData.breadcrumb` with their own `RouteMessages`.

### Components

- **`MessagesButton`** in `tanstack/layout/user-header.tsx`, next to
  `NotificationsBell`: `MessageSquareIcon` with the unread badge, a popover
  of the 5 latest conversations and **See all messages**. On mobile it lives
  in `mobile-user-menu.tsx`. The count comes from `/messages/state` and the
  `state` socket message (like `notifications/state-sync.tsx`).
- **Inbox list**: tabs Inbox / Unread / Archived, a search field, rows with
  avatar (group: up to 3 stacked), name or title, preview, relative time,
  unread dot, muted icon. `useInfiniteQuery` with `keepPreviousData` on
  filter changes, `aria-busy={isFetching}`.
- **Conversation**: header (title, participants sheet, mute/archive/leave
  menu), the message log and the composer.
  - Message log is `role="log"` with `aria-live="polite"`, newest at the
    bottom, upward infinite scroll that keeps the scroll anchor, day
    separators, consecutive messages from one author within 5 minutes
    grouped under one avatar, "New messages" divider at the read cursor,
    a "Jump to latest" button when scrolled up.
  - Own messages aligned right with `bg-primary text-primary-foreground`,
    others' left with `bg-muted text-foreground` - nothing else coloured.
  - Message actions menu: Copy, Edit, Delete (own, within the window),
    Report (others), via the existing `ReportButton`.
  - Composer: `AutoForm` with `AutoFormEditor` (comment preset). Enter
    sends on desktop, Shift+Enter is a new line; on touch devices Enter is
    a new line and the **Send** button (`SendHorizontalIcon`) sends. Draft
    kept per conversation in `localStorage` (try/catch).
  - Optimistic send: the message appears at once with a "Sending…" state
    keyed by `clientId`; on failure it shows **Try again** (`RotateCwIcon`).
  - Typing line under the log ("Anna is typing…") with an sr-only polite
    announcement at most once per 10 s.
  - The read cursor moves when the newest message is on screen and the tab
    is visible (`IntersectionObserver` + `visibilitychange`).
- **Message** buttons on the profile and in `components/user-preview-card.tsx`
  (`MessageSquareIcon` + "Message"), hidden for yourself and guests,
  disabled with a tooltip when `/messages/can-message/{userId}` says no.
- **Block / Unblock** in the profile's more menu with a `ConfirmAction`.

### Loading and errors

- Inbox and log: `FeedPendingSkeleton`-like skeletons shaped as rows and
  message bubbles; the conversation header has its own skeleton.
- First load failed: `Empty` with `role="alert"` - `MessageSquareOffIcon`
  for the inbox, `MessagesSquareIcon` for a conversation - and a retry that
  refetches in place. `404`: "This conversation doesn't exist or you left
  it", no retry.
- Background refetch failed: `Alert variant="warning"` above the log, the
  messages stay.
- Without the socket: `refetchInterval` of 15 s on the open conversation and
  60 s on the state, paused when the tab is hidden.

## AdminCP

### Settings → Messages (`/admin/core/settings/messages`)

A Sheet (a handful of fields): enable messaging (global switch; off hides
the button and answers `404` on every route), `maxParticipants`,
`maxMessageBytes`, `editWindowMinutes`. Requires a new admin permission
`settings.can_manage_messages`. Saving shows a toast and invalidates the
settings query.

### Roles → edit role → **Messages** tab

`allowMessages`, `messagesMaxRecipients` (number or Unlimited),
`conversationsPerDay` (number or Unlimited). Saved by the role form like the
Reactions tab.

### Users → user detail

Counts only: conversations, messages sent, blocked by N members (a spam
signal). Never message content.

### Dashboard

Optional widget later: messages per day.

## Documentation

- User guide: `apps/web/content/docs/guides/messages.mdx` - sending,
  groups, blocking, privacy settings, with screenshots.
- Developer: `apps/web/content/docs/dev/messages/` - events, the
  notification type, permissions, realtime messages, GDPR behaviour, how to
  link to `/messages/new?to=<id>` from a plugin.
- `built-in-events.mdx` for the new events.
- Translations in `packages/api/src/locales` and `packages/vitnode/src/locales`
  (`core.messages.*`) for every language that core ships.

## Phases

1. **Blocks and privacy.** `core_users_blocks`, block/unblock routes and UI
   on profiles, `/settings/messages` with `messagesFrom` and the block list.
   Useful on its own and needed by everything after it.
2. **Data model and API.** Tables, migration, role columns, service, all
   HTTP routes, events, rate limits, AdminCP settings and
   the role tab.
3. **UI.** Inbox, conversation, new conversation, header button, Message
   buttons, polling without the socket. Feature is usable end to end here.
4. **Notifications and email.** The notification type, delayed publish,
   preferences entry.
5. **Realtime.** The `messages/live` channel, live messages, read receipts,
   typing.
6. **Attachments.** Private `messages` folder, download access check,
   cleanup.
7. **Moderation and GDPR.** Report target, hide action, moderator
   permissions, export and erase, cleanup cron.
8. **Search and docs.** `tsvector` search, user and developer docs,
   screenshots.

Tests go in a separate session after each phase works (see `AGENTS.md`):
the service rules (limits, blocks, `messagesFrom`, edit window, read
cursor), route permissions and `404` for non-participants, the report
target, GDPR erase, and the composer/log DOM behaviour.

## Open questions

1. **Staff access to conversations.** This plan gives none outside reports.
   Some communities need an audited "view conversation" for admins (legal
   requests). Add later behind an admin permission with an audit log entry?
2. **Retention.** Should admins be able to set "delete messages older than
   N days"? Not in v1.
3. **Plugin hooks.** Do plugins need to start conversations (marketplace
   "contact seller") through a server API like `c.get("messages").start()`?
   The service is shaped for it; exposing it is a small step.
4. **Message reactions.** Register a `conversation_message` reaction target
   once the core is stable, or never (keeps messages light)?
5. **`messagesFrom` options.** Add "members with N+ reputation" or "people I
   follow" once follows exist?
