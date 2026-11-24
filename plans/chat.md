# Chat (Reddit-style private messages)

Status: implemented (v1, phases 1-8 except images and search). Owner: core
(`@vitnode/api` + `@vitnode/core`). Docs: `dev/chat` and the chat events in
`dev/events/built-in-events`.

## Implemented differently from this plan

- **No prototype round.** Messages use the existing `Bubble` / `Message` UI
  components: own messages on the end side in the primary color, others muted
  on the start side. The dock is one window with list and chat stacked.
- **Install settings live in the API config** (`chat: { enabled,
  editWindowMinutes, establishedAccountDays, maxGroupSize }`), like
  `users.accountDeletion`, not in an AdminCP sheet, plus `groups: false` for
  direct chats only. The frontend `vitnode.config.ts` has its own `chat: {
  enabled, dock }` to drop chat (or just the dock) from the UI without asking
  the API; the API's `enabled` and `groups` also reach the UI through the
  middleware config. Throttle thresholds are constants in `CHAT_LIMITS`.
- **Role settings are columns saved by the role form itself** (the role
  create/update routes take `allowChat`, `chatRequestsPerDay`,
  `chatMaxInvites`), not a separate endpoint.
- **`can_message_anyone` is a moderator permission of the `users` module**;
  the `chat` module holds the report permissions the report target generates.
- **Replying to a chat request accepts it.**
- **Ignoring a request** removes the recipient's row; the sender's chat stays
  and further messages reach nobody until the recipient writes to them, which
  rejoins the chat without the ignored history.
- **People search** (`GET /chat/people?q=`) was added for the recipient picker.
- **End-to-end encrypted chats** (added after v1): per-chat opt-in, a
  passcode-wrapped ECDH key pair per member with a recovery key, a role
  setting that requires a passcode, self-healing key re-share after a reset,
  and message franking so reports from encrypted chats carry verified text.
  See `dev/chat` "End-to-end encrypted chats".
- **Not built yet:** images in messages (phase 7 attachments), message search
  (phase 9) and the AdminCP user-detail counters.

Members talk in **chats**, the way they do on Reddit: a chat button in the
header opens a chat window docked in the corner, which stays open while you
browse. Strangers can't land in your inbox; their first message is a
**chat request** you accept or ignore. Messages are short and quick: plain
text with light formatting, images, replies to a message and emoji
reactions.

## Goals

1. **Chat from anywhere.** On desktop the header **Chat** button opens a
   docked window (bottom right) with the chat list and the open chat. It
   survives page navigation and can be expanded to the full page `/chat`. On
   mobile `/chat` is a full-screen app-like view.
2. **Requests, not spam.** A first message from someone you haven't chatted
   with goes to **Requests**. Accept to move it to your chats, **Ignore** to
   drop it silently, or **Block** / **Report**. Until you accept, the sender
   can send at most 3 text messages, and their links don't render.
3. **Direct and group chats.** One-to-one, or a group of up to 100 people
   with a name. Being added to a group by a stranger is a request too.
4. **Quick messages.** Plain text with light formatting (bold, italic, code,
   spoilers, links), up to 4 images per message, **reply** to a specific
   message, **emoji reactions**, edit within 15 minutes, delete any time.
5. **Live when possible, fine without it.** With the WebSocket: new
   messages, reactions, edits, typing and read state arrive instantly.
   Without it (serverless, socket off): polling of the open chat and the
   unread count.
6. **Members stay in control.** Who can send me chat requests (everyone,
   accounts older than N days, nobody), block list, mute, hide chat, leave
   group, read receipts on/off.
7. **Roles and anti-spam.** A **Chat** tab in the role form (allow chat,
   requests per day, max group invites). Senders whose requests are mostly
   ignored or blocked get their requests paused automatically.
8. **Safe and private.** Messages are reportable through the existing
   moderation reports; moderators see only what was reported. Staff can't
   browse chats. Suspended members are locked out (the global middleware
   already treats them as guests).
9. **GDPR from day one** through `definePersonalData`.

Non-goals (first version): end-to-end encryption, voice/video, GIF search
(needs a third-party API key - see Open questions), files other than
images, subreddit-like public chat channels, message forwarding, pinned
messages, staff browsing of chats nobody reported.

## Naming

- UI: **Chat** (Polish: _Czat_), a single conversation is a **chat**, the
  pending ones are **chat requests**.
- Code and API: module `chat` under the `@vitnode/core` plugin id:
  `fetcher({ plugin: "@vitnode/core", module: "chat", ... })`.
- Tables: `core_chat_conversations`, `core_chat_participants`,
  `core_chat_messages`, `core_chat_message_reactions`,
  `core_chat_message_files`, plus the generic `core_users_blocks`.

Add **Chat**, **Chat request**, **Participant** and **Block** to
`CONTEXT.md`.

## Design - to decide from /proto/chat

Like reactions and the preview card, the look is picked from a prototype
before Phase 3. Directions to compare:

- **Message layout**: left-aligned rows (avatar, name, time, grouped
  messages - compact, reads well in groups) vs bubbles (own messages right).
- **Dock**: one window with list and chat stacked (back arrow) vs a wider
  window with the list as a narrow rail.
- **Request screen**: a banner above the first messages with Accept /
  Ignore / Block vs a card that hides the messages until you choose.

Fixed regardless of direction: semantic tokens only (`bg-background`,
`bg-muted`, `bg-primary text-primary-foreground` for the active and own
items), no purple, `lucide-react` icons before action labels, skeletons
shaped like rows.

## Decisions

| Topic                     | Decision                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct vs group           | `kind: "direct"` (exactly 2) or `"group"` (up to `maxGroupSize`, AdminCP `2..200`, default 100). A direct chat is unique per pair (`directKey = "<minId>:<maxId>"`): starting one again opens the existing chat. Adding people to a direct chat starts a **new group** with no history copied.                                                                             |
| When a request is needed  | Recipient's participant row starts `status: "pending"` unless the pair already has an **accepted** direct chat, or the sender is staff with `chat.can_message_anyone`. The sender's row is always `accepted`.                                                                                                                                                              |
| While pending             | The sender sees "Waiting for Anna to accept" and can send at most **3 messages**, text only (no images), and links in them show as plain text to the recipient. The recipient's read state is not shown to the sender and nothing tells the sender the request was ignored.                                                                                              |
| Request actions           | **Accept** → `accepted`, the chat moves to the list, the limits go away. **Ignore** → the recipient's row is removed; the sender's chat stays as it is (they can't send more, the 3-message cap is reached or they see the waiting state forever). **Block** → ignore + block. **Report** → a report of the request's messages + block.                                    |
| Group invites             | Anyone in a group can add people when `membersCanInvite` (default `true`); the creator (host) can turn it off, rename and remove people. An added member who has no accepted direct chat with the inviter gets a **group request** showing the group name, the inviter and member count, not the messages. Accepted members see history from the moment they were invited. |
| Who can send me requests  | User setting `chatRequestsFrom`: `everyone` (default), `established` (accounts older than `establishedAccountDays`, AdminCP, default 30) or `nobody`. People you already chat with are never affected. A block always wins.                                                                                                                                                 |
| Request throttle          | Per sender, rolling 7 days: if at least 10 requests were sent and 70% or more were ignored or blocked, new requests are refused for 24 h (`429 requests_paused`). Thresholds are AdminCP settings; the AdminCP user detail shows the numbers.                                                                                                                                |
| Blocking                  | `core_users_blocks (userId, blockedUserId)`, generic. In chat: no requests or group invites from them, their messages in a **direct** chat are refused (`403 blocked`); in a shared group the UI collapses their messages behind "Blocked member - show". Max 1000 blocks per member.                                                                                     |
| Content                   | Plain text, 1..`maxMessageLength` characters (AdminCP `1..10000`, default 4000) with light markdown: `**bold**`, `*italic*`, `` `code` ``, ` ``` ` blocks, `>!spoiler!<`, line breaks, auto-linked URLs. Parsed by a small core parser into React nodes - never HTML. Stored as text (search, notifications and exports read it directly).                                 |
| Images                    | Up to 4 per message: PNG, JPEG, WebP, GIF (animated allowed), 10 MB each, private folder `chat`. Only participants who can see the message can download them - a new access check in the file download route. `sharp` writes a thumbnail and a static poster for `prefers-reduced-motion`. Role's `allowUploadFiles` applies.                                            |
| Replies                   | `replyToMessageId` on a message. The message shows a one-line quote (author + first 100 chars, "Original message deleted" when gone); clicking it jumps to the original, loading the page around it (`?around=<id>`).                                                                                                                                                      |
| Reactions                 | Any emoji, from the existing `EmojiIconPicker` (emoji only) plus 6 quick picks on hover. Own table, not the reputation reactions catalog: no points, no daily limits, readable only by participants. Max 20 distinct emoji per message; a member can add several. Hover a pill to see who reacted.                                                                        |
| Edit and delete           | Edit within `editWindowMinutes` (AdminCP, default 15) → **(edited)**. Delete own message any time → tombstone "Message deleted" (replies keep their context, reactions go away). No edit history.                                                                                                                                                                          |
| Hide, leave, mute         | **Hide chat** (direct): gone from your list until a new message arrives. **Leave** (group): system message "Anna left". **Mute** (8 h / 1 week / forever): no notifications, not in the badge. When nobody is left in a chat, the daily cron deletes it, its messages and files.                                                                                          |
| Read state and receipts   | One cursor per participant (`lastReadMessageId`). Receipts: **Seen** under your last message in a direct chat, small avatars at the last read message in groups. User setting `showReadReceipts` (default `true`), symmetric.                                                                                                                                             |
| Typing                    | WebSocket only, never stored: sent at most every 3 s, expires after 6 s, hidden from blocked members, pending requests and members who turned receipts off.                                                                                                                                                                                                               |
| Unread badge              | The Chat button shows the number of chats with unread messages (`99+`) and a separate dot when there are new requests. Muted chats and requests don't add to the number.                                                                                                                                                                                                  |
| Notifications             | Two types: `core.chat_message` (defaults `{ inApp: false, email: "immediate" }`, grouped per chat, published 2 minutes late and only if still unread) and `core.chat_request` (`{ inApp: false, email: "immediate" }`). The Chat button is the in-app channel; the bell stays for everything else. Emails never include message text.                                 |
| Staff                     | Moderator permissions `chat.can_message_anyone` (skips requests, `nobody` and blocks - for warnings and support) and `chat.can_hide`. No permission reads chats; moderators see reported messages only.                                                                                                                                                                    |
| Suspended members         | Locked out by the global middleware (`user = null`, routes answer `401`). Their chats stay for the others.                                                                                                                                                                                                                                                                  |
| Deleted members           | Participant rows, reactions and images go; messages stay with `authorId = null`, shown as **Deleted member**.                                                                                                                                                                                                                                                              |
| Guests                    | Never: the guest role gets `allowChat = false`; every route needs a user session.                                                                                                                                                                                                                                                                                            |
| Pagination                | `bigserial` ids, pages of 50 by cursor (`before`, `after`, `around`), so scrolling never skips or repeats while messages arrive.                                                                                                                                                                                                                                           |
| Search                    | Inside your own chats only, a `tsvector` column on messages - never `core_search_index`.                                                                                                                                                                                                                                                                                   |

## Data model (`packages/api/src/database/chat.ts`)

```ts
export const core_chat_conversations = camelCase.table.withRLS(
  "core_chat_conversations",
  t => ({
    id: t.serial().primaryKey(),
    kind: t.varchar({ enum: ["direct", "group"], length: 16 }).notNull(),
    /** `"<minUserId>:<maxUserId>"` for direct chats, `null` for groups. */
    directKey: t.varchar({ length: 32 }).unique(),
    title: t.varchar({ length: 100 }),
    iconId: t.integer().references(() => core_files.id, { onDelete: "set null" }),
    hostId: t.integer().references(() => core_users.id, { onDelete: "set null" }),
    membersCanInvite: t.boolean().notNull().default(true),
    lastMessageId: t.bigint({ mode: "number" }),
    lastMessageAt: t.timestamp(),
    membersCount: t.integer().notNull().default(0),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
);

export const core_chat_participants = camelCase.table.withRLS(
  "core_chat_participants",
  t => ({
    conversationId: t.integer().notNull()
      .references(() => core_chat_conversations.id, { onDelete: "cascade" }),
    userId: t.integer().notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    status: t.varchar({ enum: ["pending", "accepted"], length: 16 }).notNull(),
    invitedById: t.integer().references(() => core_users.id, { onDelete: "set null" }),
    invitedAt: t.timestamp().notNull().defaultNow(),
    acceptedAt: t.timestamp(),
    leftAt: t.timestamp(),
    /** Messages before this id are not visible (joined later). */
    firstVisibleMessageId: t.bigint({ mode: "number" }).notNull().default(0),
    hiddenUntilMessageId: t.bigint({ mode: "number" }),
    lastReadMessageId: t.bigint({ mode: "number" }).notNull().default(0),
    mutedUntil: t.timestamp(),
  }),
  t => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("core_chat_participants_list_idx").on(t.userId, t.status, t.leftAt),
  ],
);

export const core_chat_messages = camelCase.table.withRLS(
  "core_chat_messages",
  t => ({
    id: t.bigserial({ mode: "number" }).primaryKey(),
    conversationId: t.integer().notNull()
      .references(() => core_chat_conversations.id, { onDelete: "cascade" }),
    authorId: t.integer().references(() => core_users.id, { onDelete: "set null" }),
    kind: t.varchar({ enum: ["message", "system"], length: 16 }).notNull(),
    body: t.text(),
    /** `{ type: "joined" | "left" | "removed" | "renamed" | "created", ... }` */
    system: t.jsonb().$type<ChatSystemEvent>(),
    replyToMessageId: t.bigint({ mode: "number" }),
    /** The sender's id for an optimistic message; a retried send is a no-op. */
    clientId: t.varchar({ length: 64 }),
    /** Sent while the chat was a pending request (links render as text). */
    sentAsRequest: t.boolean().notNull().default(false),
    hiddenByModeratorAt: t.timestamp(),
    searchVector: tsvector("search_vector"),
    createdAt: t.timestamp().notNull().defaultNow(),
    editedAt: t.timestamp(),
    deletedAt: t.timestamp(),
  }),
  t => [
    index("core_chat_messages_page_idx").on(t.conversationId, t.id),
    index("core_chat_messages_author_idx").on(t.authorId),
    unique("core_chat_messages_client_key").on(t.authorId, t.clientId),
    index("core_chat_messages_search_idx").using("gin", t.searchVector),
  ],
);

export const core_chat_message_reactions = camelCase.table.withRLS(
  "core_chat_message_reactions",
  t => ({
    messageId: t.bigint({ mode: "number" }).notNull()
      .references(() => core_chat_messages.id, { onDelete: "cascade" }),
    userId: t.integer().notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    emoji: t.varchar({ length: 32 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })],
);

export const core_chat_message_files = camelCase.table.withRLS(
  "core_chat_message_files",
  t => ({
    messageId: t.bigint({ mode: "number" }).notNull()
      .references(() => core_chat_messages.id, { onDelete: "cascade" }),
    fileId: t.integer().notNull()
      .references(() => core_files.id, { onDelete: "cascade" }),
    position: t.smallint().notNull(),
  }),
  t => [primaryKey({ columns: [t.messageId, t.fileId] })],
);

export const core_users_blocks = camelCase.table.withRLS(
  "core_users_blocks",
  t => ({
    userId: t.integer().notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    blockedUserId: t.integer().notNull()
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

Request outcomes for the throttle are counted from a small log,
`core_chat_request_outcomes (senderId, recipientId, outcome, createdAt)`
with `outcome: "accepted" | "ignored" | "blocked"`, pruned after 30 days.

### Changes to existing tables

- `core_roles`: `allowChat boolean default true` (`false` for the guest role
  in the migration), `chatRequestsPerDay integer default 20` (`null` =
  unlimited), `chatMaxInvites integer default 10` (people added at once).
  Several roles: the most generous wins, as with reactions.
- `core_users`: `chatRequestsFrom varchar(16) default 'everyone'`,
  `showReadReceipts boolean default true`.
- Relations in `database/relations.ts`.

## Server API (`packages/api/src/modules/chat`)

Every route requires a user session, answers `Cache-Control: private,
no-store`, and is counted per user by the `read` / `write` rate limits.
`loadParticipant(c, conversationId)` answers `404` (never `403`) for chats
you're not in, so ids can't be probed.

| Method   | Path                                               | What                                                                                                                                                                                                    |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/chat/state`                                      | `{ unreadChats, requests, lastMessageId }` for the Chat button.                                                                                                                                         |
| `GET`    | `/chat`                                            | Chat list: `?filter=all\|unread\|requests&cursor=&q=`. Row: name/title, avatar(s), last message preview (plain, 100 chars; "Photo" for images), unread, muted, pending.                               |
| `POST`   | `/chat`                                            | Start `{ userIds, title?, body?, fileIds?, clientId }`. One user and an existing direct chat → appends there (`200`), otherwise `201`. Checks role, daily limit, `chatRequestsFrom`, blocks, throttle. |
| `GET`    | `/chat/{id}`                                       | Chat header: kind, title, members (with read cursors if receipts are on), my status and settings, `canInvite`, `canWrite`, pending limits left.                                                        |
| `GET`    | `/chat/{id}/messages`                              | `?before=`, `?after=` or `?around=`, `limit` 50 (max 100). Each message with reply preview, images and reaction summary (`[{ emoji, count, reacted }]`).                                             |
| `POST`   | `/chat/{id}/messages`                              | Send `{ body?, fileIds?, replyToMessageId?, clientId }`.                                                                                                                                                |
| `PATCH`  | `/chat/{id}/messages/{messageId}`                  | Edit within the window.                                                                                                                                                                                 |
| `DELETE` | `/chat/{id}/messages/{messageId}`                  | Delete (tombstone).                                                                                                                                                                                     |
| `PUT`    | `/chat/{id}/messages/{messageId}/reactions/{emoji}` | Add a reaction; `DELETE` same path removes it. `GET .../reactions` lists who reacted.                                                                                                                 |
| `POST`   | `/chat/{id}/read`                                  | `{ messageId }`, moves the cursor forward only.                                                                                                                                                         |
| `POST`   | `/chat/{id}/accept`                                | Accept a request.                                                                                                                                                                                       |
| `POST`   | `/chat/{id}/ignore`                                | Ignore a request (`{ block?: boolean }`).                                                                                                                                                               |
| `PATCH`  | `/chat/{id}`                                       | Host: `title`, `iconId`, `membersCanInvite`. Anyone: `mutedUntil`, `hidden`.                                                                                                                            |
| `POST`   | `/chat/{id}/members`                               | Add `{ userIds }` to a group.                                                                                                                                                                           |
| `DELETE` | `/chat/{id}/members/{userId}`                      | Host removes someone; your own id = leave.                                                                                                                                                              |
| `GET`    | `/chat/search`                                     | `?q=` over your visible messages.                                                                                                                                                                       |
| `GET`    | `/chat/settings`, `PUT` same                       | `chatRequestsFrom`, `showReadReceipts`.                                                                                                                                                                 |
| `GET`    | `/chat/can-chat/{userId}`                          | `{ allowed, asRequest, reason }` so a profile can label the button **Chat** or **Send chat request**, or disable it.                                                                                   |
| `GET`    | `/users/blocks`, `PUT` / `DELETE /users/blocks/{userId}` | Block list (generic, under `users`).                                                                                                                                                              |

Error codes: `not_allowed` (role), `daily_limit`, `requests_paused`,
`recipient_unavailable` (deleted, `nobody`, not established, blocked - one
code so nobody learns they were blocked), `request_limit` (4th message
before accept), `blocked`, `edit_window`, `group_full`, `too_many_invites`.

### Service (`packages/api/src/lib/chat/service.ts`)

The service owns every rule so routes, the WebSocket handler and a future
plugin API share them: `startChat`, `sendMessage`, `editMessage`,
`deleteMessage`, `react`, `unreact`, `markRead`, `acceptRequest`,
`ignoreRequest`, `addMembers`, `removeMember`.

Each write is one transaction with `pg_advisory_xact_lock(conversationId)`
(ids follow commit order, as in reactions): insert, update the chat's
`lastMessageId/At`, clear others' `hiddenUntilMessageId`, move the sender's
cursor. After commit: realtime push, delayed notification task, events,
invalidation of each recipient's `chat:state:<userId>` cache entry.

The light-markdown parser lives in `@vitnode/api/lib/chat/format`
(browser-safe), so the server (plain-text previews, search, emails) and the
client (rendering) read messages the same way.

### Events (`packages/api/src/events/chat.ts`)

`chat.created`, `chat.request_accepted`, `chat.request_ignored`,
`chat.member_added`, `chat.member_removed` (`reason: "left" | "removed"`),
`chat.message_created`, `chat.message_updated`, `chat.message_deleted`,
`user.blocked`, `user.unblocked`. Ids only, never content. Documented in
`apps/web/content/docs/dev/events/built-in-events.mdx`.

### Notifications

- `core.chat_message`: category `chat`, grouped by chat ("3 new messages
  from Anna"), `subjectType: "core.chat"`. `sendMessage` enqueues a queue
  task (`availableAt = now + 2 min`, deduped per chat and recipient) that
  publishes only if the recipient's cursor is still behind and the chat is
  not muted. `access` re-checks before the email goes out.
- `core.chat_request`: one per request, sent at once ("Anna wants to chat").
- Emails link to `/chat/<id>` and never quote messages.

### Realtime (`packages/api/src/lib/chat/live`)

Channel `chat/live` on the existing registry. Recipients are known, so the
server pushes with `c.get("realtime").sendToUsers()` - no rooms:

```ts
type ChatLiveServerMessage =
  | { type: "message"; chatId: number; message: ChatMessage }
  | { type: "message_updated"; chatId: number; message: ChatMessage }
  | { type: "message_deleted"; chatId: number; messageId: number }
  | { type: "reactions"; chatId: number; messageId: number; reactions: ChatReactionSummary[] }
  | { type: "read"; chatId: number; userId: number; messageId: number }
  | { type: "typing"; chatId: number; userId: number }
  | { type: "chat"; chatId: number } // header, members or status changed
  | { type: "state"; unreadChats: number; requests: number };
```

The browser only sends `{ type: "typing", chatId }`; the server checks
membership (cached 60 s per socket), throttles and filters blocked and
pending pairs. `reactions` carries `reacted` per recipient, so it is built
per user in the batch.

### Moderation

`defineReportTarget` type `chat_message`, permission module `chat`:

- `capture` snapshots the reported message plus up to 5 before it as
  read-only context. Reporting a **request** captures all of its messages.
- Action `hide` (`chat.can_hide`) shows "Hidden by a moderator" to everyone.
- `resolveAuthors` returns the author, so a warning can follow the report.

### GDPR (`lib/account-deletion/core-personal-data.ts`)

- **Export**: own messages (chat id, date, text, image names), own
  reactions, chat titles, block list, chat settings. Not other people's
  messages.
- **Erase**: participant rows, reactions, blocks and request outcomes
  (cascade), own images, `authorId = null` on messages (FK), then delete
  chats with no active member left.

### Cron

`chat-cleanup` (daily): delete chats nobody is in any more (and hidden
direct chats with no message for 7 days), prune request outcomes older than
30 days, delete orphaned uploads in the `chat` folder.

## Front end (`@vitnode/core/tanstack/chat`)

Route files stay topology only; screens, queries and namespaces live in
`@vitnode/core/tanstack/chat`.

| Route                | Screen                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/chat`              | Mobile: the chat list. `md`+: list on the left, "Pick a chat or start a new one" on the right.                                              |
| `/chat/$chatId`      | Mobile: full-screen chat with a back button. `md`+: list + chat (the list stays mounted with `<Activity>`).                                 |
| `/chat/requests`     | Requests list with Accept / Ignore on each row.                                                                                             |
| `/chat/new`          | `?to=<userId>` preselects. People picker (search, chips, max = role invites), group name for 2+, the composer.                              |
| `/settings/chat`     | New settings item: who can send me requests, read receipts, block list, link to the email preferences of the two notification types.       |

### Chat button and dock

- **`ChatButton`** in `tanstack/layout/user-header.tsx`, next to
  `NotificationsBell`: `MessageCircleIcon`, the unread number and the
  request dot. On mobile it lives in `mobile-user-menu.tsx` and links to
  `/chat`.
- **Dock (`lg`+)**: clicking the button toggles a floating window in the
  bottom-right corner (about 400 × 600, never over 80% of the viewport
  height). It holds the list and one chat with a back arrow, plus
  **Open full screen** (`Maximize2Icon`) and **Minimize**. Mounted once in
  `VitNodeRootProviders`, lazy-loaded (`React.lazy` + `Suspense` with a row
  skeleton) on first open and kept with `<Activity>` across navigation, so
  a half-written message survives. Hidden on `/chat` itself. Its open state
  and chat are remembered in `sessionStorage` (try/catch).
- The dock is a non-modal `role="dialog"` with `aria-label`, focus moves in
  on open and back to the button on close, `Escape` minimizes. Opening
  animates `transform`/`opacity` only, `motion-reduce:` makes it instant.
- **Chat** buttons on the profile and in
  `components/user-preview-card.tsx` (`MessageCircleIcon`, label
  **Chat** or **Send chat request** from `/chat/can-chat`), hidden for
  yourself and guests. On desktop they open the chat in the dock.
- **Block / Unblock** in the profile's more menu, with `ConfirmAction`.

### Chat view

- Header: avatar(s), name or title, member count, a menu (Mute, Hide chat
  or Leave, Members, Report, Block for direct chats).
- Message list: `role="log"` with `aria-live="polite"`, newest at the
  bottom, upward infinite scroll keeping the scroll anchor, day separators,
  messages from one author within 5 minutes grouped, a "New messages"
  divider at the read cursor and a **Jump to latest** button.
- Message hover (desktop) or long-press (touch) actions: quick reactions,
  **Reply** (`ReplyIcon`), **Edit**, **Delete**, **Copy text**, **Report**.
- Reply bar above the composer with the quoted message and a close button.
- Reaction pills under a message (`emoji count`, pressed when yours), hover
  card with the first names, sheet with everyone.
- Images: a grid (1-4), click opens a lightbox; GIFs show their poster under
  `prefers-reduced-motion`.
- Composer: a `textarea` that grows to 6 lines, **Image** button
  (`ImageIcon`), emoji picker, **Send** (`SendHorizontalIcon`). Enter sends,
  Shift+Enter is a new line; on touch, Enter is a new line. Counter shown
  from 90% of the length limit. Draft per chat in `localStorage`.
  (A chat composer is a single field, not a settings form, so it is not an
  `AutoForm`.)
- Optimistic send keyed by `clientId`: "Sending…", then the real message;
  on failure **Try again** (`RotateCwIcon`).
- Request view (recipient): the first messages with links as text and the
  choice bar **Accept** (`CheckIcon`), **Ignore** (`XIcon`), **Block**
  (`BanIcon`), **Report** (`FlagIcon`). Sender: "Waiting for Anna to
  accept - 2 messages left".
- Typing line ("Anna is typing…"), announced to screen readers at most once
  per 10 s.
- The read cursor moves when the newest message is visible and the tab is
  visible (`IntersectionObserver` + `visibilitychange`).

### Loading and errors

- List and log: row and message skeletons with the real sizes; the header
  has its own.
- First load failed: `Empty` with `role="alert"` (`MessageCircleOffIcon` for
  the list, `MessagesSquareIcon` for a chat) and a retry that refetches in
  place; `404`: "This chat doesn't exist or you left it", no retry.
- Background refetch failed: `Alert variant="warning"` above the messages.
- Without the socket: `refetchInterval` 10 s for the open chat and 60 s for
  the state, paused while the tab is hidden.

## AdminCP

- **Settings → Chat** (Sheet): enable chat (off hides the button and answers
  `404`), `maxGroupSize`, `maxMessageLength`, `editWindowMinutes`,
  `establishedAccountDays`, request throttle thresholds. New admin
  permission `settings.can_manage_chat`.
- **Roles → edit role → Chat tab**: `allowChat`, `chatRequestsPerDay`,
  `chatMaxInvites` (each with Unlimited where it applies).
- **Users → user detail**: chats, messages sent, requests sent in 7 days
  and how many were ignored or blocked, whether requests are paused, blocked
  by N members. Never message content.

## Documentation

- User guide `apps/web/content/docs/guides/chat.mdx`: starting a chat,
  requests, groups, replies and reactions, blocking, privacy settings, with
  screenshots.
- Developer `apps/web/content/docs/dev/chat/`: events, notification types,
  permissions, realtime messages, GDPR behaviour, linking to
  `/chat/new?to=<id>` from a plugin.
- `built-in-events.mdx`; translations `core.chat.*` in both packages for
  every language core ships.

## Phases

0. **Prototype** `/proto/chat`: message layout, dock, request screen.
   Record the decision at the top of this plan, as reactions did.
1. **Blocks and settings**: `core_users_blocks`, block UI, `/settings/chat`.
2. **Data model and API**: tables, migration, role columns, service,
   routes, events, rate limits, AdminCP settings and role tab.
3. **Full-page chat**: `/chat` list and chat, new chat, Chat button,
   profile and preview-card buttons, polling. Usable end to end.
4. **Requests and notifications**: request flow and UI, throttle, both
   notification types and emails.
5. **Moderation and GDPR**: report target, hide, export, erase, cleanup
   cron. **First release** after this phase.
6. **Realtime**: `chat/live`, typing, read receipts.
7. **Replies, reactions, images**.
8. **Dock**.
9. **Search and docs**.

Tests go in a separate session after each phase works (see `AGENTS.md`):
the service rules (requests, pending limits, throttle, blocks,
`chatRequestsFrom`, edit window, read cursor), `404` for non-members and
route permissions, the markdown parser, the report target, GDPR erase, and
the composer/log/dock DOM behaviour.

## Open questions

1. **GIFs.** Reddit-style GIF search needs Giphy or Tenor and an API key.
   Add as an optional integration later?
2. **Mentions in groups.** `@name` with autocomplete that notifies even in a
   muted group?
3. **Staff access.** No reading of chats outside reports. Do some
   communities need an audited admin view for legal requests?
4. **Retention.** "Delete messages older than N days" as an AdminCP option?
5. **Plugin API.** `c.get("chat").start()` for plugins ("Contact seller")?
6. **Public chat channels** (chat rooms tied to a forum or category) - a
   separate feature on top of the same tables later?
