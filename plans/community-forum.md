# Content Engine: container policies, approvals, threads and the Forum plugin

Status: in progress on canary. Owner: Content Engine + `@vitnode/forum`.

Stages covered: 3 (container policies and scoped permissions), 4 (approval
workflow and ModCP queue), 5 (threaded content), 8 (Forum plugin MVP), 10
(performance, SEO, DX). Deferred: reactions (6), subscriptions (7), reports and
ModCP integration of reports for forum content (9).

## Audit (canary @ 95428da8)

- Stage 3 is **not** implemented. `resolveContentPublicationPolicy()` returns
  `publicWrite.create.status`; containers have no policy storage.
- Scoped moderator permissions exist (moderation MVP): a permission entry may
  declare `scope: "<family>"`, grants carry `{ family, mode, ids }`, and
  `hasStaffPermission(set, { resource: { family, id } })` decides. Root roles
  pass every check.
- A `draft` row never reaches public list, detail, slug, delivery, sitemap,
  public search or report capture. Search indexes drafts as private documents.
- Editorial `update` writes the live row; there is no shadow copy. Revisions
  are unique per `(type, item, version)` and pruned by retention, so a pending
  proposal cannot live in `core_content_revisions`.
- To-one `field.relation({ self: true })` throws when the table is built.
- `publicApi` requires exactly one slug field and forbids user fields.
- Moderator permission modules are written by several registrars that skip a
  module already present, so `publicWrite` `can_edit` and the report
  permissions cannot coexist on one content type.

## Stage 3 - container policies

### Storage

`core_content_containers.policies jsonb not null default '{}'`:

```ts
type ContentContainerPolicyOverrides = {
  [contentTypeId: string]: Partial<ContentContainerPolicy>;
};
interface ContentContainerPolicy {
  create: "members" | "moderators"; // who may create
  publish: "immediate" | "approve"; // new records
  edits: "immediate" | "approve"; // author edits of published records
  authorEdit: "always" | "never" | "window";
  authorEditMinutes: number; // used by "window"
}
```

A missing key means "inherit". An explicit value - including `"never"` - is an
override. The engine never stores `undefined`.

### Definition

```ts
defineContentContainer({
  id: "forum.forums",
  policies: {
    defaults: {
      publish: "immediate",
      edits: "immediate",
      authorEdit: "always",
    },
    contentTypes: {
      "forum.reply": { authorEdit: "window", authorEditMinutes: 60 },
    },
  },
});
```

`policies` absent = the container does not participate, and content types in it
keep their pre-Stage-3 behaviour (`publicWrite.create.status`, owners edit
forever, unscoped `can_edit`).

### Effective policy (pure, `resolveContentContainerPolicy`)

For every key independently:

1. the current container's override for the content type;
2. the nearest ancestor's override (walking `parentId`);
3. `definition.policies.contentTypes[contentTypeId]`;
4. `definition.policies.defaults`;
5. the engine fallback: `create: "members"`, `publish` from
   `publicWrite.create.status` (`published` -> `immediate`, `draft` ->
   `approve`), `edits: "immediate"`, `authorEdit: "always"`,
   `authorEditMinutes: 60`.

### Container of a record

A content type's container comes from either its own `field.container()` or a
to-one relation marked `field.relation({ target, container: true })`, which
inherits the related record's container (a reply lives in its topic's forum).
The inherited value is never client-writable and is always resolved on the
server from the related row.

### Scoped permissions

- Every container definition with `policies` registers a moderation scope
  family with the container definition id (`forum.forums`). Resources are
  container ids (`"12"`) and explicit subtrees (`"12:tree"`, "this forum and
  every forum below it"). A plain id never covers descendants.
- Content types in such a container get moderator permissions under their
  `permissionModule`, scoped by that family: `can_edit` (editAny), `can_approve`
  (approve and see the queue). Entries merge with the report permissions
  instead of replacing them.
- A record in container `C` with ancestors `A1..An` is covered by a grant whose
  ids contain `C`, `C:tree` or any `Ai:tree`, or by an unscoped / `mode: "all"`
  grant, or by a root role. Being staff alone grants nothing.
- `create: "moderators"` lets only `can_edit` holders in that container create.
- Holders of `can_approve` in the container skip approval for their own posts.

### Author editing

`editOwn` is allowed while the record is not hidden and the effective
`authorEdit` allows it: `always`, `never`, or `window` measured from the
record's server `createdAt`. Moderator editing (`can_edit` in scope) is
independent of the window.

### AdminCP

`GET/PUT /admin/.../content/{containerModule}/{id}/policies` returns the
overrides, the effective policy per content type and where each value came from;
`PUT` replaces the overrides after strict validation. The container sheet gets a
"Publishing" section per content type with an "Inherit" choice for every key.

## Stage 4 - approvals

### Model

`core_content_submissions` (one row per proposal, never deleted with content):

| column                                 | notes                                                        |
| -------------------------------------- | ------------------------------------------------------------ |
| `id`                                   | serial                                                       |
| `pluginId`, `contentTypeId`, `itemId`  | target; `itemId` is `contentIdKey`                           |
| `containerId`, `containerDefinitionId` | scope at submission time, refreshed at decision              |
| `kind`                                 | `create` or `edit`                                           |
| `status`                               | `pending`, `approved`, `rejected`, `superseded`, `cancelled` |
| `values`                               | proposed values (writable fields only)                       |
| `baseValues`                           | the live values the edit was made against                    |
| `baseVersion`                          | editorial version the edit was made against                  |
| `authorId`, `reviewerId`               | users, `set null` on delete                                  |
| `reason`                               | rejection reason                                             |
| `revisionId`                           | revision written by the approval                             |
| `createdAt`, `updatedAt`, `decidedAt`  | server timestamps                                            |

Partial unique index: one `pending` row per `(contentTypeId, itemId)`.

Publication stays `draft | published`. A pending **create** is a `draft` row
plus a `create` submission - nothing public can reach a draft. A pending
**edit** never touches the row; the proposal lives in `values`.

### Rules

- The server decides the outcome from the effective policy; the client never
  sends a status.
- Author creates in an `approve` container: row stored as draft, submission
  `pending`, response carries `approval`.
- Author edits a published record with `edits: "approve"`: validated like a
  normal edit, stored as a proposal. A second edit **replaces** the pending
  proposal (old row `superseded`). The live row and its version do not change.
- Author edits a record whose create is pending: the draft row is updated in
  place, the pending submission's `values` follow it.
- Author edits a record whose create was rejected: the draft row is updated and
  a new `create` submission is opened (resubmission).
- Moderator edits always apply immediately. If a proposal is pending its base
  version is now stale; approving it answers `409 stale` and the moderator
  rejects it (the author may resubmit).
- Approve/reject lock the submission row (`FOR UPDATE`) and require
  `status = 'pending'`; a second decision answers `409 decided`.
- Decisions re-resolve the record's **current** container and authorize
  `can_approve` against it. A record that is gone cancels the submission
  (`409 gone`).
- Approving a create publishes the draft (one `published` event). Approving an
  edit runs the editorial update with `expectedVersion = baseVersion` (one
  `updated` event, one revision). Rejecting changes nothing on the record.
- Hidden records keep their `hiddenAt`; approving a hidden create publishes it
  but it stays hidden.
- Policy changes do not touch pending submissions.

### Events

`content.approval.submitted`, `content.approval.approved`,
`content.approval.rejected` with
`{ submissionId, pluginId, contentTypeId, contentId, containerId, kind, authorId, reviewerId?, reason? }`.

### API (core `moderation` module, `approvals` sub-paths)

- `GET /moderation/approvals` - scoped queue (page, pageSize, status, contentTypeId, containerId).
- `GET /moderation/approvals/filters` - content types and containers the moderator may review.
- `GET /moderation/approvals/{id}` - proposal, current live values, history.
- `POST /moderation/approvals/{id}/approve`, `POST /moderation/approvals/{id}/reject`.
- `GET /moderation/approvals/mine` - the signed-in author's submissions.

### UI

ModCP `/modcp/approvals` (list + detail with compare, approve, reject).

## Stage 5 - threads

- To-one self relations are supported.
- `thread: { parent: "<self relation>", root: "<to-one relation>", maxDepth }`
  on a content type: the parent must be the same type, in the same root, public,
  and above `maxDepth`. The parent is set on create only, so cycles cannot form.
- `GET /{path}/thread?root=<id>&first&after` pages top-level replies (oldest
  first, `createdAt, id`) and returns their public descendants. A non-public
  ancestor of a public reply is returned as a tombstone (`removed: true`, no
  values) so the tree stays intact.
- `field.slug({ generated: true })` gives records without a natural title (a
  reply) a server-generated permalink slug.
- `publicApi.people: ["author"]` publishes a user field as a public profile
  summary (name, nameCode, avatar, role color/prefix) - an explicit opt-in next
  to the strict `fields` allowlist.

## Stage 8 - Forum plugin (`@vitnode/forum`)

- `forum.forums` container (policies on), `forum.topic`, `forum.reply`.
- Pages: `/forum`, `/forum/:slug`, `/forum/topics/new`, `/forum/topics/:slug`,
  `/forum/topics/:id/edit`.
- Topic stats (public reply count, last activity) from a plugin route.

## Stage 10

Indexes for thread and listing queries, page cache on public routes, canonical
URLs, JSON-LD `DiscussionForumPosting`, sitemap via delivery, docs for every
feature.
