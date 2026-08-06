export const CONTENT_SYSTEM_FIELDS = ["id", "createdAt", "updatedAt"] as const;

export const CONTENT_PUBLICATION_FIELDS = ["status", "publishedAt"] as const;

/**
 * The column `editorial: { enabled: true }` adds.
 *
 * Its own list rather than an entry in `CONTENT_SYSTEM_FIELDS`, for the same
 * reason the publication fields are separate: it exists only for a content type
 * that opted in, so a Stage 1 type stays free to declare a field of its own
 * called `version`.
 */
export const CONTENT_EDITORIAL_FIELDS = ["version"] as const;

export const CONTENT_PUBLICATION_STATUSES = ["draft", "published"] as const;

const publicationStatuses: ReadonlySet<string> = new Set(
  CONTENT_PUBLICATION_STATUSES,
);

export const isContentPublicationStatus = (
  value: unknown,
): value is (typeof CONTENT_PUBLICATION_STATUSES)[number] =>
  typeof value === "string" && publicationStatuses.has(value);

export const CONTENT_PUBLICATION_STATUS_LENGTH = 32;

export const CONTENT_FILTERABLE_FIELD_KINDS = [
  "boolean",
  "enum",
  "number",
  "relation",
  "slug",
  "text",
  "user",
] as const;

const filterableFieldKinds: ReadonlySet<string> = new Set(
  CONTENT_FILTERABLE_FIELD_KINDS,
);

export const isFilterableFieldKind = (kind: string): boolean =>
  filterableFieldKinds.has(kind);

export const RESERVED_FILTER_KEYS = [
  "cursor",
  "first",
  "last",
  "order",
  "orderBy",
  "search",
] as const;

/** `plugin.entity`, e.g. `example.article`. */
export const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;

/** Postgres identifier: snake_case, starts with a letter. */
export const CONTENT_TABLE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/** camelCase, matching `casing: "camelCase"` on the Drizzle client. */
export const CONTENT_FIELD_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

/** Explicit index names follow the same snake_case rule as table names. */
export const CONTENT_INDEX_NAME_PATTERN = CONTENT_TABLE_NAME_PATTERN;

/** Postgres silently truncates identifiers past this length. */
export const CONTENT_IDENTIFIER_MAX_LENGTH = 63;

/** Next rejects a cache tag longer than this. A slug alone can be 160. */
export const CONTENT_CACHE_TAG_MAX_LENGTH = 256;

export const CONTENT_TEXT_DEFAULT_LENGTH = 255;
export const CONTENT_ENUM_DEFAULT_LENGTH = 64;

export const CONTENT_SLUG_DEFAULT_LENGTH = 160;

export const CONTENT_DEFAULT_PAGE_SIZE = 25;
export const CONTENT_OPTIONS_LIMIT = 25;

export const CONTENT_PUBLIC_DEFAULT_PAGE_SIZE = 25;
export const CONTENT_PUBLIC_MAX_PAGE_SIZE = 50;

export const CONTENT_PUBLIC_PATH_PATTERN = /^[a-z][a-z0-9-]*$/;

export const CONTENT_PUBLIC_PATH_MAX_LENGTH = 64;

export const CONTENT_PUBLIC_RESERVED_PATHS = ["admin"] as const;

export const CONTENT_PUBLIC_EXPOSABLE_KINDS = [
  "boolean",
  "dateTime",
  "enum",
  "number",
  "relation",
  "slug",
  "text",
  "textarea",
] as const;

export const CONTENT_PUBLIC_EXPOSABLE_COLUMNS = [
  "id",
  "createdAt",
  "updatedAt",
  "publishedAt",
] as const;

export const CONTENT_PUBLIC_ALWAYS_ORDERABLE = "publishedAt";

/**
 * Field kinds `search.titleField` may name.
 *
 * `text` only. A search title is one line, weighted `A` by the index; prose from
 * a `textarea` in that slot ruins ranking for every other document, and a slug
 * is already in the URL.
 */
export const CONTENT_SEARCH_TITLE_KINDS = ["text"] as const;

/** Field kinds `search.descriptionField` may name. */
export const CONTENT_SEARCH_DESCRIPTION_KINDS = ["text", "textarea"] as const;

/**
 * Field kinds `search.contentFields` may name.
 *
 * Prose only. `enum`, `number`, `boolean` and `dateTime` are facets, not text:
 * full-text-indexing `"draft"` or `"42"` is noise, and it would let a searcher
 * probe values. `relation` is a foreign key, and `user` is never public.
 */
export const CONTENT_SEARCH_TEXT_KINDS = ["slug", "text", "textarea"] as const;

/** The only placeholder `search.pathTemplate` may use. */
export const CONTENT_SEARCH_SLUG_PLACEHOLDER = "{slug}";

/**
 * `core_search_index.itemType` is `varchar(100)` and a content type id is used
 * verbatim as the item type, so a longer id would fail at insert time - far from
 * the definition that caused it.
 */
export const CONTENT_SEARCH_ITEM_TYPE_MAX_LENGTH = 100;

export const CONTENT_SEARCH_PATH_MAX_LENGTH = 512;

/**
 * What a revision records.
 *
 * One per *real* mutation - a no-op update, an idempotent publish and a
 * cancelled schedule all write nothing at all.
 */
export const CONTENT_REVISION_OPERATIONS = [
  "create",
  "delete",
  "publish",
  "restore",
  "unpublish",
  "update",
] as const;

/**
 * Who performed a mutation.
 *
 * `system` exists so a scheduled publish needs no fake user id. Who *created*
 * the schedule is kept on the schedule row, not invented here.
 */
export const CONTENT_ACTOR_TYPES = ["api", "staff", "system"] as const;

/** The envelope `snapshot` is stored in, so a future shape change is visible. */
export const CONTENT_REVISION_SNAPSHOT_VERSION = 1;

/**
 * How many of the newest revisions are kept per record.
 *
 * Pruned in the same transaction that writes the new one, so the table stays
 * bounded without a background job - an install with no cron adapter must not
 * grow forever.
 */
export const CONTENT_REVISION_DEFAULT_RETENTION = 50;
export const CONTENT_REVISION_MIN_RETENTION = 1;
export const CONTENT_REVISION_MAX_RETENTION = 500;

/**
 * How long a preview link stays valid.
 *
 * The ceiling is a day: a preview token is a bearer credential for an
 * unpublished record, and its expiry is the only thing that revokes it.
 */
export const CONTENT_PREVIEW_DEFAULT_TTL_MINUTES = 15;
export const CONTENT_PREVIEW_MIN_TTL_MINUTES = 1;
export const CONTENT_PREVIEW_MAX_TTL_MINUTES = 1440;

/** The only placeholder `editorial.preview.pathTemplate` may use. */
export const CONTENT_PREVIEW_TOKEN_PLACEHOLDER = "{token}";

/**
 * The preview token format.
 *
 * Carried inside the signed payload so a future change to the shape is a
 * rejected token rather than a misread one - old links stop working, which is
 * the correct outcome for a credential whose meaning moved.
 */
export const CONTENT_PREVIEW_TOKEN_VERSION = 1;

export const CONTENT_PREVIEW_PATH_MAX_LENGTH = 512;

/** What a schedule does when it fires. */
export const CONTENT_SCHEDULE_ACTIONS = ["publish", "unpublish"] as const;

/**
 * Where a schedule is in its life.
 *
 * There is deliberately no `failed`. Marking one would need the handler to know
 * the queue row's attempt count, which it never receives - and an overdue
 * `pending` row with `lastError` set says the same thing with one fewer state
 * that can be wrong.
 */
export const CONTENT_SCHEDULE_STATUSES = [
  "cancelled",
  "completed",
  "pending",
] as const;

/**
 * How far in the past a `scheduledFor` may be and still be accepted.
 *
 * One cron tick plus slack. A browser clock a minute behind the server is
 * ordinary, and "now" is what the editor meant - rejecting it would be a
 * puzzle, not a safeguard. Anything earlier is a mistake worth naming.
 */
export const CONTENT_SCHEDULE_PAST_TOLERANCE_MS = 120_000;

/** How long a completed or cancelled schedule is kept as an audit trail. */
export const CONTENT_SCHEDULE_RETENTION_DAYS = 30;

/**
 * The single core queue task that executes every content schedule.
 *
 * One task rather than one per content type: `queueTasks` are collected from
 * top-level modules only, and `buildContentAdminModule` is nested inside a
 * plugin's admin module - so a task registered there would be silently dropped.
 */
export const CONTENT_QUEUE_TASK_SCHEDULE = "content-schedule";

/**
 * The follow-up task that announces a schedule that has already happened.
 *
 * Separate from {@link CONTENT_QUEUE_TASK_SCHEDULE} because the two have
 * different failure meanings. The transition is a database write that either
 * committed or did not; the effects are an event, a search write and an HTTP
 * hop to another process, any of which can fail long after the record is
 * already published. Retrying them together would re-run an idempotent publish
 * that then skips its own announcements - which is how a scheduled unpublish
 * ends up permanently missing its cache invalidation.
 *
 * Dispatched **inside** the transition's transaction, so the task exists if and
 * only if the transition committed.
 */
export const CONTENT_QUEUE_TASK_SCHEDULE_EFFECTS = "content-schedule-effects";

/** Machine-readable reasons a schedule was refused. */
export const CONTENT_SCHEDULE_CODES = {
  inPast: "CONTENT_SCHEDULE_IN_PAST",
  order: "CONTENT_SCHEDULE_ORDER",
  unsupported: "CONTENT_SCHEDULE_UNSUPPORTED",
} as const;

/**
 * Every content type gets the first four staff permissions. `can_publish` is
 * generated only for content types with `publication: { enabled: true }`, and
 * `can_restore` only for those with `editorial: { enabled: true }`.
 */
export const CONTENT_PERMISSIONS = {
  create: "can_create",
  delete: "can_delete",
  edit: "can_edit",
  publish: "can_publish",
  restore: "can_restore",
  view: "can_view",
} as const;

/**
 * Machine-readable reasons a write was refused.
 *
 * A code rather than a sentence, because the AdminCP has to *act* on the
 * difference - a version conflict reloads the record and offers to overwrite, a
 * unique clash points at a field. Prose cannot be branched on, and the
 * driver's own message must never reach a client.
 */
export const CONTENT_CONFLICT_CODES = {
  unique: "CONTENT_UNIQUE_CONFLICT",
  version: "CONTENT_VERSION_CONFLICT",
} as const;

export const CONTENT_UNPROCESSABLE_CODES = {
  notRestorable: "CONTENT_REVISION_NOT_RESTORABLE",
} as const;
