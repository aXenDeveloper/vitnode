# Content Engine: live editing, autosave and presence

Status: in progress (canary). Owner: Content Engine.

## Goals

1. **Autosave.** Nobody loses work. Edits are saved continuously to a shared
   working copy (the _draft_), never to the published record. `Save` and
   `Publish` stay explicit commits.
2. **Presence.** Editors see who else is in the record and _where_ they are:
   which field and which language.
3. **Hard field locks.** A plain field (title, slug, excerpt, relations, files,
   ...) is edited by one person at a time. Everyone else sees it read-only with
   "Anna is editing", and gets the value live.
4. **Co-editing in the rich text editor.** The rich text field is the exception:
   many people type in it at once, with live carets (Yjs).
5. **JSON content + SSR without the editor.** Rich text is stored as ProseMirror
   JSON and rendered on the server by a pure renderer. The public bundle never
   ships Tiptap, ProseMirror or Yjs.

Non-goals: offline-first editing, comments and suggestions (see "Later").

## Constraints found in the code

- Every editorial `PUT` bumps `version`, writes a revision (retention 20) and
  runs the commit effects (events, search indexing, revalidation). Autosave
  must not go through it.
- A draft is not a separate copy: `status = "draft"` lives on the same row, so
  autosaving a published record would change live content. Autosave writes to
  separate tables instead.
- The WebSocket layer (`packages/vitnode/src/ws`) knows users, not rooms. The
  socket is only mounted by `apps/api` (long-lived Node). Vercel/serverless
  has no socket.
- The socket only knows the _user_ session. The AdminCP session cookie
  (`path=/`) does reach the upgrade request, so a handler can resolve it with
  `SessionAdminModel` and check `can_edit` itself.
- The editor (Tiptap v3) stores HTML today and is uncontrolled after mount.

## Decisions

| Topic | Decision |
| --- | --- |
| Where autosave goes | `core_content_drafts` (plain fields) and `core_content_documents` (Yjs state of rich text fields). Never the record. |
| Draft scope | One shared draft per record and language, not per user. It is the team's working copy. |
| Plain fields | Hard lock per field and language, a lease in `core_content_field_locks`. |
| Rich text | `field.richText()`, ProseMirror JSON in `jsonb`, co-edited through Yjs. |
| Transport | Existing `/api/ws` socket, one core channel, rooms on top of the registry. Redis pub/sub for multi-instance. |
| No socket (serverless) | Locks and drafts work over HTTP with polling. Rich text falls back to a single-editor lock. |
| Migration | Canary: none. `blog.post.content` changes from `textarea` to `richText` (breaking). A one-time HTML to JSON script is written before the stable release. |
| New packages | `yjs`, `y-protocols`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-caret`, `@tiptap/y-tiptap` (core only). |

## Architecture

```
AdminCP form ──HTTP──▶ /content/{module}/{id}/locks    (acquire, renew, release)
     │                 /content/{module}/{id}/draft    (read, write locked fields)
     │                 PUT /{id}, /{id}/localized       (commit = Save, unchanged)
     │
     └──WS /api/ws──▶ channel "@vitnode/core_content_live"
                        join/leave/focus  ─▶ presence of the record room
                        doc:* (Yjs sync)  ─▶ rich text documents
                        ◀─ presence, locks, draft, doc:update, doc:awareness, reset
                                   │
                         Redis "vitnode:ws" (room fan-out across instances)
```

### Rooms (WebSocket layer)

`ws/registry.ts` gains rooms:

- `wsRegistry.join(ws, room)`, `wsRegistry.leave(ws, room)`,
  `wsRegistry.roomsOf(ws)`, `wsRegistry.toRoom(room, id, data, { except })`.
- `realtime.toRoom(room, channel, data)` delivers locally and publishes a
  `room` message on `vitnode:ws`, so other instances deliver to their members.
- `onConnectionClose(listener)` lets features clean up (presence, locks) when a
  socket goes away.

Room names: `content:{contentTypeId}:{itemId}` for a record and
`content-doc:{contentTypeId}:{itemId}:{field}:{locale|_}` for one rich text
document.

### Protocol (`content/live/protocol.ts`)

One channel, `createWebSocketChannel({ pluginId: "@vitnode/core", module: "content", id: "live" })`.
JSON messages, binary Yjs payloads as base64.

Client to server:

| type | payload | effect |
| --- | --- | --- |
| `join` | `room`, `locale` | Authorize (AdminCP session + `can_edit`), join the room, reply `joined` with members. |
| `leave` | `room` | Leave the room and every document room of it. |
| `focus` | `room`, `field`, `locale` | Update presence ("Anna is in Title (PL)"). |
| `doc:open` | `doc`, `stateVector` | Join the document room. Server replies with `doc:update` (what the client misses) and `doc:state-vector`. |
| `doc:update` | `doc`, `update` | Apply on the server doc, relay to the document room, schedule persistence. |
| `doc:awareness` | `doc`, `update` | Relay carets and selections. |
| `doc:close` | `doc` | Leave the document room. |

Server to client: `joined`, `presence`, `locks`, `draft`, `doc:update`,
`doc:state-vector`, `doc:awareness`, `doc:seed`, `reset`, `error`.

### Presence

Per record room, the server keeps `{ connectionId, userId, name, avatar,
locale, field }` for each member and broadcasts the list on every change. A
member leaves on `leave`, on socket close, or after a missed heartbeat.

### Field locks (`core_content_field_locks`)

- Key: `(content_type_id, item_id, field, language)`. `language` is `""` for
  shared fields. Value: `user_id`, `acquired_at`, `expires_at`.
- `POST /{id}/locks` with `{ field, locale, action: "acquire" | "renew" | "release" }`.
  Acquire is one atomic upsert that only succeeds when the lock is free,
  expired, or already held by the caller. A conflict is a `409` naming the
  holder.
- Lease 60 s, renewed every 20 s while the field has focus.
- `GET /{id}/locks` lists live locks (also the polling fallback).
- Every change is broadcast to the record room as `locks`.
- A socket close releases that user's locks in the room when they have no
  other connection in it.
- `can_edit` is required for everything. Rich text fields are never locked
  while the socket is up.

### Drafts (`core_content_drafts`)

- Key: `(content_type_id, item_id, language)`. `values` is `jsonb`.
  `base_version`, `updated_at`, `updated_by`.
- `GET /{id}/draft` returns the shared and per-language drafts.
- `PUT /{id}/draft` with `{ locale, values }` merges only fields the caller
  holds a lock for (otherwise `409`). The result is broadcast as `draft`.
- The form opens with record values overlaid by draft values, and shows
  "Draft saved at 14:32" and "Unsaved changes" (draft differs from record).
- `Save` commits the overlaid values through the existing routes. The draft
  stays; it now equals the record. Restoring a revision deletes the drafts and
  documents of that record and broadcasts `reset`.
- The editorial cleanup cron deletes drafts and documents older than 30 days
  whose `base_version` is behind the record.

### Rich text (`field.richText()`)

- New field kind `richText`, `localized` allowed. Column `jsonb`. Value is a
  ProseMirror document `{ type: "doc", content: [...] }`.
- Validation: recursive Zod schema with a node allowlist, max depth and max
  serialized size.
- `RichTextContent` (`@vitnode/core/components/rich-text`) renders the JSON to
  React on the server and the client. A registry maps node and mark types to
  renderers; unknown nodes render their children. Links are sanitized.
- `richTextToPlainText()` feeds search, SEO descriptions, excerpts and
  revision diffs. `richTextToHtml()` is a string renderer for AI prompts and
  emails.
- The admin editor works in JSON mode: `onChange(editor.getJSON())`.

### Co-editing (Yjs)

- One `Y.Doc` per `(record, field, language)`. The Tiptap `Collaboration`
  extension binds the editor to it, `CollaborationCaret` shows carets with the
  member's name and color. Undo and redo come from Yjs (per user).
- Client provider (`content/live/provider.ts`) speaks the protocol above over
  the shared socket and owns an `Awareness`.
- Server (`content/server/live/documents.ts`) keeps loaded documents in memory
  per instance, applies and relays updates, mirrors them to other instances
  over Redis, and persists the merged state to `core_content_documents`
  (debounced 2 s, and when the last member leaves).
- Seeding: when no state is stored, the server asks the first client to seed
  the document from the record JSON (`doc:seed`). Only one client is chosen.
- `Save` sends the editor JSON in the normal payload. The server never has to
  turn Yjs into JSON.
- Without the socket, the editor is a normal JSON editor guarded by the field
  lock.

### AdminCP and the blog

- `ContentForm` gets a live session (`useContentLiveSession`) when the record
  exists: join, presence, locks, draft overlay, autosave indicator.
- Locked fields render read-only with the holder's avatar. Focus acquires the
  lock; blur releases it.
- The page header shows the avatars of everyone in the record. The language
  switcher shows who is in each language.
- The blog switches `content` to `field.richText({ localized: true, required: true })`,
  renders it with `RichTextContent`, and its AI tools (excerpt, translate)
  read text with `richTextToPlainText` / `richTextToHtml` and write back
  through editor commands, so changes flow through Yjs to everyone.

## Phases

| Phase | Scope | Notes |
| --- | --- | --- |
| 0 | Rooms in the WS registry, protocol contract, shared constants | Foundation for everything below. |
| 1 | `field.richText`, renderer, plain text and HTML helpers, editor JSON mode, blog switch | Independent. |
| 2 | Live server: WS handler, auth, presence, Yjs document sync and persistence | Builds on 0. |
| 3 | Locks and drafts: tables, routes, broadcasts, cleanup | Builds on 0. |
| 4 | AdminCP client: live session, presence UI, lock UI, autosave, collaborative editor, blog editor | Builds on 1-3. |
| 5 | Docs and migration files | Last. |

Phases 1, 2 and 3 run in parallel.

## Testing

Vitest, following `AGENTS.md`: no `vi.mock` where a seam exists.

- Rooms: join, leave, `toRoom` with `except`, cleanup on close, pub/sub
  delivery to room members only.
- Live handler: rejects without an AdminCP session or without `can_edit`;
  presence lists; focus updates.
- Documents: two clients converge; updates relay to the document room only;
  persistence and reload; seeding picks one client.
- Locks: acquire, conflict `409`, renew, expiry, release, release on close.
- Drafts: merge only locked fields, reject unlocked, read overlay, reset on
  restore.
- Rich text: schema accepts valid docs and rejects bad ones; renderer DOM
  output for each node and mark; link sanitizing; plain text extraction.
- UI: locked field is read-only and names the holder; presence avatars.

## Docs

- `dev/content-engine/live-editing.mdx`: autosave, presence, locks, co-editing,
  deployment notes (socket and Redis).
- `dev/content-engine/fields.mdx`: `field.richText`.
- `dev/content-engine/rich-text.mdx`: rendering with `RichTextContent`,
  custom node renderers, helpers.
- `dev/websocket.mdx`: rooms.
- `guides/blog.mdx`: what editors see.

## Later

Anchored comments, suggestion mode, AI as a visible collaborator, version
history from Yjs snapshots, co-editing the visual page editor.
