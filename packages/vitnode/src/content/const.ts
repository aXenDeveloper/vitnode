/**
 * Columns the Content Engine always adds. They can never be declared as
 * content fields - `defineContentType` rejects them.
 */
export const CONTENT_SYSTEM_FIELDS = ["id", "createdAt", "updatedAt"] as const;

/**
 * Query-string keys owned by pagination and ordering. A filter may not use one
 * of these names or it would silently shadow the pagination contract.
 */
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

/** Postgres truncates identifiers past this length. */
export const CONTENT_TABLE_NAME_MAX_LENGTH = 63;

export const CONTENT_TEXT_DEFAULT_LENGTH = 255;
export const CONTENT_ENUM_DEFAULT_LENGTH = 64;

export const CONTENT_DEFAULT_PAGE_SIZE = 25;
export const CONTENT_OPTIONS_LIMIT = 25;

/** Every content type gets these four staff permissions. */
export const CONTENT_PERMISSIONS = {
  create: "can_create",
  delete: "can_delete",
  edit: "can_edit",
  view: "can_view",
} as const;
