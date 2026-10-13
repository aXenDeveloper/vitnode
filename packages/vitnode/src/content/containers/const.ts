export const CONTENT_CONTAINER_FIELD_KINDS = [
  "boolean",
  "enum",
  "number",
  "text",
  "textarea",
] as const;

/** Columns every container row has. A definition's own fields live beside them, in `metadata`. */
export const CONTENT_CONTAINER_COLUMNS = [
  "id",
  "parentId",
  "name",
  "slug",
  "position",
  "createdAt",
  "updatedAt",
] as const;

/** Names a definition field cannot take: the columns above, plus the shape the API returns. */
export const CONTENT_CONTAINER_RESERVED_FIELDS = [
  ...CONTENT_CONTAINER_COLUMNS,
  "children",
  "definitionId",
  "depth",
  "metadata",
  "pluginId",
] as const;

export const CONTENT_CONTAINER_ORDERING_MODES = [
  "manual",
  "alphabetical",
] as const;

export const CONTENT_CONTAINER_DEFAULT_MAX_DEPTH = 5;

/**
 * The deepest tree any definition may ask for. The tree is assembled in memory
 * from one query per definition, so depth costs nothing to read - the ceiling
 * is about what a navigation UI can still show without becoming a staircase.
 */
export const CONTENT_CONTAINER_ABSOLUTE_MAX_DEPTH = 10;

export const CONTENT_CONTAINER_NAME_MAX_LENGTH = 255;

export const CONTENT_CONTAINER_SLUG_MAX_LENGTH = 160;

/**
 * Containers per definition. A forum with ten thousand boards is not a forum,
 * and the bound is what keeps "load the whole tree in one query" honest.
 */
export const CONTENT_CONTAINER_MAX_PER_DEFINITION = 5000;

/** Codes a container write can be refused with. The AdminCP translates each one. */
export const CONTENT_CONTAINER_ERROR_CODES = [
  "cycle",
  "definitionMismatch",
  "hasChildren",
  "hasContent",
  "invalidInput",
  "invalidMetadata",
  "invalidPosition",
  "limitReached",
  "maxDepth",
  "notFound",
  "parentNotFound",
  "slugEmpty",
  "slugTaken",
] as const;
