export const CONTENT_SYSTEM_FIELDS = ["id", "createdAt", "updatedAt"] as const;

export const CONTENT_PUBLICATION_FIELDS = ["status", "publishedAt"] as const;

export const CONTENT_EDITORIAL_FIELDS = ["version"] as const;

export const CONTENT_TRANSLATION_SYSTEM_FIELDS = [
  "itemId",
  "languageId",
  "version",
  "createdAt",
  "updatedAt",
] as const;

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

/** camelCase, matching the `camelCase.table` factory every VitNode table uses. */
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

// ---------------------------------------------------------------------------
// File fields
// ---------------------------------------------------------------------------

export const CONTENT_FILE_EXTENSION_PATTERN = /^\.[a-z0-9]+$/;

/** `type/subtype`, lowercased. Parameters (`; charset=`) are not a file type. */
export const CONTENT_FILE_MIME_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

export const CONTENT_FILE_PLUGIN_SEPARATOR = "-";

export const CONTENT_FILE_COLLECTION_DEFAULT_MAX = 20;
export const CONTENT_FILE_COLLECTION_ABSOLUTE_MAX = 200;

export const CONTENT_FILE_CODES = {
  extension: "CONTENT_FILE_EXTENSION_NOT_ALLOWED",
  /** The role may view this content type but not write it. */
  forbidden: "CONTENT_FILE_FORBIDDEN",
  /** The bytes were unreadable - a truncated or corrupt image. */
  invalid: "CONTENT_FILE_INVALID",
  mimeType: "CONTENT_FILE_MIME_TYPE_NOT_ALLOWED",
  missing: "CONTENT_FILE_NOT_FOUND",
  size: "CONTENT_FILE_TOO_LARGE",

  storage: "CONTENT_FILE_STORAGE_UNAVAILABLE",
  /** The URL named a field this content type does not have, or that is not a file. */
  unknownField: "CONTENT_FILE_FIELD_UNKNOWN",

  unprocessable: "CONTENT_FILE_UNPROCESSABLE",
} as const;

/** Appended to the base table name to get the generated translation table. */
export const CONTENT_TRANSLATION_TABLE_SUFFIX = "_translations";

// ---------------------------------------------------------------------------
// Advanced modeling (Stage 6)
// ---------------------------------------------------------------------------

/** What separates a container from its leaf in a canonical path: `seo.title`. */
export const CONTENT_PATH_SEPARATOR = ".";

export const CONTENT_ADVANCED_LEAF_KINDS = [
  "boolean",
  "dateTime",
  "enum",
  "number",
  "text",
  "textarea",
] as const;

export const CONTENT_REPEATABLE_DEFAULT_MAX = 100;
export const CONTENT_REPEATABLE_ABSOLUTE_MAX = 1000;

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

export const CONTENT_LOCALIZATION_FALLBACKS = ["none", "default"] as const;

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
  // A file is exposable, and what crosses is the normalised descriptor rather
  // than the `core_files.id` the column holds: an identifier is useless to a
  // reader with no route to resolve it, while the descriptor is already the
  // allowlisted shape. `user` stays absent - publishing a person is a decision
  // `core_users` gets to make, not a side effect of an article having an author.
  "file",
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

export const CONTENT_SEARCH_TITLE_KINDS = ["text"] as const;

/** Field kinds `search.descriptionField` may name. */
export const CONTENT_SEARCH_DESCRIPTION_KINDS = ["text", "textarea"] as const;

export const CONTENT_SEARCH_TEXT_KINDS = ["slug", "text", "textarea"] as const;

/** The placeholder every `search.pathTemplate` must use. */
export const CONTENT_SEARCH_SLUG_PLACEHOLDER = "{slug}";

export const CONTENT_SEARCH_LOCALE_PLACEHOLDER = "{locale}";

export const CONTENT_SEARCH_ITEM_TYPE_MAX_LENGTH = 100;

export const CONTENT_SEARCH_PATH_MAX_LENGTH = 512;

export const CONTENT_REVISION_OPERATIONS = [
  "create",
  "delete",
  "publish",
  "restore",
  "unpublish",
  "update",
] as const;

export const CONTENT_TRANSLATION_REVISION_OPERATIONS = [
  "create",
  "delete",
  "publish",
  "restore",
  "unpublish",
  "update",
] as const;

export const CONTENT_ACTOR_TYPES = ["api", "staff", "system"] as const;

/** The envelope `snapshot` is stored in, so a future shape change is visible. */
export const CONTENT_REVISION_SNAPSHOT_VERSION = 1;

export const CONTENT_REVISION_DEFAULT_RETENTION = 50;
export const CONTENT_REVISION_MIN_RETENTION = 1;
export const CONTENT_REVISION_MAX_RETENTION = 500;

export const CONTENT_PREVIEW_DEFAULT_TTL_MINUTES = 15;
export const CONTENT_PREVIEW_MIN_TTL_MINUTES = 1;
export const CONTENT_PREVIEW_MAX_TTL_MINUTES = 1440;

/** The only placeholder `editorial.preview.pathTemplate` may use. */
export const CONTENT_PREVIEW_TOKEN_PLACEHOLDER = "{token}";

export const CONTENT_PREVIEW_QUERY_PARAM = "preview";

export const CONTENT_PREVIEW_TOKEN_VERSION = 1;

export const CONTENT_PREVIEW_PATH_MAX_LENGTH = 512;

/** What a schedule does when it fires. */
export const CONTENT_SCHEDULE_ACTIONS = ["publish", "unpublish"] as const;

export const CONTENT_SCHEDULE_STATUSES = [
  "cancelled",
  "completed",
  "pending",
] as const;

export const CONTENT_SCHEDULE_PAST_TOLERANCE_MS = 120_000;

/** How long a completed or cancelled schedule is kept as an audit trail. */
export const CONTENT_SCHEDULE_RETENTION_DAYS = 30;

export const CONTENT_QUEUE_TASK_SCHEDULE = "content-schedule";

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

export const CONTENT_DELIVERY_TITLE_KINDS = ["text"] as const;

/** Field kinds `delivery.seo.descriptionField` may name. */
export const CONTENT_DELIVERY_DESCRIPTION_KINDS = ["text", "textarea"] as const;

export const CONTENT_DELIVERY_NO_INDEX_KINDS = ["boolean"] as const;

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

export const CONTENT_SITEMAP_MAX_URLS = 50_000;

export const CONTENT_SITEMAP_DEFAULT_PAGE_SIZE = 1_000;

export const CONTENT_DELIVERY_REDIRECT_STATUS = 308;

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

export const CONTENT_ADMIN_FORM_MODES = ["dialog", "page"] as const;

export const CONTENT_ADMIN_CREATE_SEGMENT = "create";
export const CONTENT_ADMIN_EDIT_SEGMENT = "edit";

export const CONTENT_ADMIN_PATH_SEGMENT_PATTERN = /^[a-z][a-z0-9-]*$/;

export const CONTENT_PERMISSIONS = {
  create: "can_create",
  delete: "can_delete",
  edit: "can_edit",
  publish: "can_publish",
  restore: "can_restore",
  view: "can_view",
} as const;

export const CONTENT_CONFLICT_CODES = {
  unique: "CONTENT_UNIQUE_CONFLICT",
  version: "CONTENT_VERSION_CONFLICT",
} as const;

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
