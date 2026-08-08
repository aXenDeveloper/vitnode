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

/**
 * The columns a generated translation table always carries.
 *
 * Its own list rather than an entry in {@link CONTENT_SYSTEM_FIELDS}: these live
 * on the *translation* table, so a content type stays free to declare a shared
 * field called `itemId` - it would land on the base table, where nothing
 * generated claims that name.
 */
export const CONTENT_TRANSLATION_SYSTEM_FIELDS = [
  "itemId",
  "languageId",
  "version",
  "createdAt",
  "updatedAt",
] as const;

/**
 * The two columns a translation row gains when the content type has publication.
 *
 * The same names the base table uses, and deliberately so: a translation's
 * lifecycle is the same lifecycle, one row down. Present only with
 * `publication: { enabled: true }` - without it there is no draft state for a
 * translation's own status to be subordinate to.
 */
export const CONTENT_TRANSLATION_PUBLICATION_FIELDS = [
  "status",
  "publishedAt",
] as const;

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

/**
 * Field kinds that may carry `localized: true`.
 *
 * Text only, and deliberately so. `boolean`, `number`, `date`, `dateTime` and
 * `enum` hold values, not prose - a per-locale `true` is not a translation, and
 * an enum's *labels* are already handled by the ordinary i18n system while its
 * *identifiers* have to stay the same in every language or nothing can filter on
 * them. `relation` and `user` are foreign keys, and per-locale references are
 * explicitly out of scope.
 */
export const CONTENT_LOCALIZED_FIELD_KINDS = [
  "slug",
  "text",
  "textarea",
] as const;

const localizedFieldKinds: ReadonlySet<string> = new Set(
  CONTENT_LOCALIZED_FIELD_KINDS,
);

export const isLocalizableFieldKind = (kind: string): boolean =>
  localizedFieldKinds.has(kind);

/** Appended to the base table name to get the generated translation table. */
export const CONTENT_TRANSLATION_TABLE_SUFFIX = "_translations";

// ---------------------------------------------------------------------------
// Advanced modeling (Stage 6)
// ---------------------------------------------------------------------------

/** What separates a container from its leaf in a canonical path: `seo.title`. */
export const CONTENT_PATH_SEPARATOR = ".";

/**
 * Field kinds that may sit inside a `group` or a `repeatable`.
 *
 * Scalars only, and every exclusion is a decision rather than an oversight:
 *
 * - **group** - nesting would need a second level of column naming and a second
 *   level of partial-update merging, for no modelling gain a second group next
 *   to the first does not already give.
 * - **repeatable** - a child table of a child table is a tree, and a tree needs
 *   its own ordering, its own cascade and its own restore semantics.
 * - **slug** - a slug is a URL segment with a uniqueness scope. Inside a group
 *   the scope would be the row (fine) and inside a repeatable it would be the
 *   parent (not a URL at all), so one name would mean two things.
 * - **relation** / **user** - a foreign key the relation services do not look
 *   at is a foreign key nothing maintains. Model it as a to-many relation on the
 *   content type instead.
 */
export const CONTENT_ADVANCED_LEAF_KINDS = [
  "boolean",
  "dateTime",
  "enum",
  "number",
  "text",
  "textarea",
] as const;

/**
 * How many children one repeatable field may hold, unless it says otherwise.
 *
 * A ceiling exists at all because every write replaces the whole list in one
 * statement and every read loads it whole: a repeatable is a handful of FAQ
 * entries, not a table. An author who wants more should model a content type.
 */
export const CONTENT_REPEATABLE_DEFAULT_MAX = 100;
export const CONTENT_REPEATABLE_ABSOLUTE_MAX = 1000;

/**
 * How many targets one to-many relation may hold.
 *
 * Same reasoning as the repeatable ceiling, and the same shape of enforcement:
 * the generated schema rejects a longer array before any query runs.
 */
export const CONTENT_RELATION_COLLECTION_MAX = 500;

/** The first position of an ordered collection. Contiguous from here. */
export const CONTENT_COLLECTION_FIRST_POSITION = 0;

/** The columns every generated junction table carries. */
export const CONTENT_JUNCTION_SYSTEM_FIELDS = [
  "itemId",
  "relatedItemId",
  "position",
  "createdAt",
] as const;

/**
 * The columns every generated repeatable child table carries.
 *
 * `id` is a `serial` of its own rather than `(itemId, position)`: position is
 * where a row currently sits, and identity has to survive a reorder or "edit the
 * third one" means something different after every drag.
 */
export const CONTENT_REPEATABLE_SYSTEM_FIELDS = [
  "id",
  "itemId",
  "position",
  "createdAt",
  "updatedAt",
] as const;

/** Machine-readable reasons an advanced write was refused. */
export const CONTENT_ADVANCED_CODES = {
  duplicateTarget: "CONTENT_RELATION_DUPLICATE_TARGET",
  missingChild: "CONTENT_REPEATABLE_UNKNOWN_CHILD",
  missingTarget: "CONTENT_RELATION_MISSING_TARGET",
  notOrdered: "CONTENT_RELATION_NOT_ORDERED",
} as const;

/**
 * What a public read does when a locale has no translation.
 *
 * Resolved in Stage 5A and *acted on* in Stage 5C: the configuration has to be
 * stable before anything reads through it, or every localized content type would
 * change public behaviour the moment fallback landed.
 */
export const CONTENT_LOCALIZATION_FALLBACKS = ["none", "default"] as const;

/**
 * A locale as `core_languages.code` stores one: `en`, `pl`, `pt-BR`, `zh-Hans`.
 *
 * Matched case-insensitively - the resolver returns the canonical stored code,
 * so `PL` in a URL resolves to the `pl` row rather than to a 404.
 */
export const CONTENT_LOCALE_PATTERN = /^[a-z]{2,8}(?:[-_][a-z0-9]{2,8})*$/i;

/** `core_languages.code` is `varchar(32)`. */
export const CONTENT_LOCALE_MAX_LENGTH = 32;

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

/** The placeholder every `search.pathTemplate` must use. */
export const CONTENT_SEARCH_SLUG_PLACEHOLDER = "{slug}";

/**
 * The placeholder a **localized** `search.pathTemplate` must also use.
 *
 * Required there rather than optional: a localized content type is indexed once
 * per language, and two languages routinely answer to the same slug - so a
 * template without it would give every translation of a record the same link, and
 * a search hit would point at whichever language the reader happened to be in.
 * Refused on a content type that is not localized, where it could only ever
 * substitute to nothing.
 */
export const CONTENT_SEARCH_LOCALE_PLACEHOLDER = "{locale}";

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
 * What a *translation* revision records.
 *
 * The same six operations, and the same one-per-real-mutation rule. Its own list
 * rather than a reuse of {@link CONTENT_REVISION_OPERATIONS} so the two can
 * diverge without a silent widening - a translation cannot be scheduled, and a
 * shared row cannot be translated.
 */
export const CONTENT_TRANSLATION_REVISION_OPERATIONS = [
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

// ---------------------------------------------------------------------------
// Content delivery (Stage 8)
// ---------------------------------------------------------------------------

/**
 * Field kinds `delivery.seo.titleField` may name.
 *
 * `text` only, and the same reasoning `CONTENT_SEARCH_TITLE_KINDS` gives: a
 * `<title>` is one line, a `textarea` in that slot puts a paragraph in a browser
 * tab, and a slug is already in the URL the title accompanies.
 */
export const CONTENT_DELIVERY_TITLE_KINDS = ["text"] as const;

/** Field kinds `delivery.seo.descriptionField` may name. */
export const CONTENT_DELIVERY_DESCRIPTION_KINDS = ["text", "textarea"] as const;

/**
 * Field kinds `delivery.seo.noIndexField` may name.
 *
 * `boolean` only: "should a crawler index this" has two answers, and a truthy
 * string would make the sitemap's exclusion rule depend on what somebody typed.
 */
export const CONTENT_DELIVERY_NO_INDEX_KINDS = ["boolean"] as const;

/**
 * The `changefreq` values the sitemap protocol defines.
 *
 * Validated rather than passed through: a crawler ignores an unknown value
 * silently, so a typo would be a hint nobody ever receives.
 */
export const CONTENT_SITEMAP_CHANGE_FREQUENCIES = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
] as const;

const sitemapChangeFrequencies: ReadonlySet<string> = new Set(
  CONTENT_SITEMAP_CHANGE_FREQUENCIES,
);

export const isContentSitemapChangeFrequency = (
  value: unknown,
): value is (typeof CONTENT_SITEMAP_CHANGE_FREQUENCIES)[number] =>
  typeof value === "string" && sitemapChangeFrequencies.has(value);

/**
 * The sitemap protocol's own ceiling: 50,000 URLs in one file.
 *
 * A delivery sitemap page never returns more than this, and the index helper
 * chunks by it - so a content type with a million records produces a sitemap
 * index rather than an invalid document.
 */
export const CONTENT_SITEMAP_MAX_URLS = 50_000;

/**
 * How many URLs one `sitemap.list` page returns by default.
 *
 * Far below the protocol ceiling on purpose: a page is one keyset query plus one
 * batched translation read, and 1,000 rows is a response a serverless function
 * can hold without thinking about it. A caller that wants a whole 50,000-URL
 * file asks for it explicitly.
 */
export const CONTENT_SITEMAP_DEFAULT_PAGE_SIZE = 1_000;

/**
 * The redirect a moved canonical URL answers with.
 *
 * `308` rather than `301`, and the difference is not cosmetic: `301` lets a
 * client rewrite the method to `GET`, `308` does not. A content URL is read with
 * `GET` today, so the two behave identically now - and only one of them still
 * behaves correctly the day somebody `POST`s to a form under a moved path.
 *
 * One status, not a configuration knob: every historical URL of every content
 * type answers with this, so there is no per-content-type setting to get wrong
 * and no reason for two of them to disagree.
 */
export const CONTENT_DELIVERY_REDIRECT_STATUS = 308;

/**
 * How a delivery resolution came out.
 *
 * `not_found` rather than a `gone` tombstone: the engine has no abstraction that
 * distinguishes "deleted on purpose" from "unpublished for now", and a `410`
 * that guessed would tell a crawler to forget a URL that is coming back.
 */
export const CONTENT_DELIVERY_RESOLUTIONS = [
  "content",
  "not_found",
  "redirect",
] as const;

/** `core_content_slug_history.path` is `varchar(512)`. */
export const CONTENT_DELIVERY_PATH_MAX_LENGTH = 512;

/** Machine-readable reasons a delivery write or read was refused. */
export const CONTENT_DELIVERY_CODES = {
  invalidUrl: "CONTENT_DELIVERY_INVALID_URL",
  notEnabled: "CONTENT_DELIVERY_NOT_ENABLED",
  redirectConflict: "CONTENT_DELIVERY_REDIRECT_CONFLICT",
  slugReserved: "CONTENT_DELIVERY_SLUG_RESERVED",
} as const;

/**
 * Every content type gets the first four staff permissions. `can_publish` is
 * generated only for content types with `publication: { enabled: true }`,
 * `can_restore` only for those with `editorial: { enabled: true }`, and
 * `can_translate` only for those with `localization: { enabled: true }`.
 */
export const CONTENT_PERMISSIONS = {
  create: "can_create",
  delete: "can_delete",
  edit: "can_edit",
  publish: "can_publish",
  restore: "can_restore",
  translate: "can_translate",
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

/**
 * Machine-readable reasons a *translation* write was refused.
 *
 * A separate list from {@link CONTENT_CONFLICT_CODES} rather than three more
 * members of it: the base 409 union is the contract Stage 4 editorial routes
 * already publish, and widening it would change a response schema every existing
 * client is generated from. A translation route answers its own union.
 */
export const CONTENT_TRANSLATION_CONFLICT_CODES = {
  defaultRequired: "CONTENT_DEFAULT_TRANSLATION_REQUIRED",
  exists: "CONTENT_TRANSLATION_EXISTS",
  languageDisabled: "CONTENT_LANGUAGE_DISABLED",
  unique: "CONTENT_TRANSLATION_UNIQUE_CONFLICT",
  version: "CONTENT_TRANSLATION_VERSION_CONFLICT",
} as const;

export const CONTENT_UNPROCESSABLE_CODES = {
  notRestorable: "CONTENT_REVISION_NOT_RESTORABLE",
} as const;
