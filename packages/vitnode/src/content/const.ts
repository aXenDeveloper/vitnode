/**
 * Columns the Content Engine always adds. They can never be declared as
 * content fields - `defineContentType` rejects them.
 */
export const CONTENT_SYSTEM_FIELDS = ["id", "createdAt", "updatedAt"] as const;

/**
 * Field kinds a generated equality filter understands.
 *
 * `textarea` and `dateTime` are absent on purpose: equality against a body of
 * prose, or against one exact timestamp, is never what anyone means.
 *
 * One list, three consumers - the filter schema, the query builder and the
 * public service types all derive from it, so they cannot drift apart.
 */
export const CONTENT_FILTERABLE_FIELD_KINDS = [
  "boolean",
  "enum",
  "number",
  "relation",
  "text",
  "user",
] as const;

const filterableFieldKinds: ReadonlySet<string> = new Set(
  CONTENT_FILTERABLE_FIELD_KINDS,
);

/**
 * Whether a field of this kind may back a generated equality filter.
 *
 * Takes a plain `string` rather than `ContentFieldKind` so this module stays
 * free of type imports from `types.ts`, which imports from here.
 */
export const isFilterableFieldKind = (kind: string): boolean =>
  filterableFieldKinds.has(kind);

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

/** Explicit index names follow the same snake_case rule as table names. */
export const CONTENT_INDEX_NAME_PATTERN = CONTENT_TABLE_NAME_PATTERN;

/** Postgres silently truncates identifiers past this length. */
export const CONTENT_IDENTIFIER_MAX_LENGTH = 63;

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
