export const CONTENT_SYSTEM_FIELDS = ["id", "createdAt", "updatedAt"] as const;

export const CONTENT_PUBLICATION_FIELDS = ["status", "publishedAt"] as const;

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
 * Every content type gets the first four staff permissions. `can_publish` is
 * generated only for content types with `publication: { enabled: true }`.
 */
export const CONTENT_PERMISSIONS = {
  create: "can_create",
  delete: "can_delete",
  edit: "can_edit",
  publish: "can_publish",
  view: "can_view",
} as const;
