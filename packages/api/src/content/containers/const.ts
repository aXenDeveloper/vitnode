export const CONTENT_CONTAINER_FIELD_KINDS = [
  "boolean",
  "enum",
  "icon",
  "number",
  "text",
  "textarea",
] as const;

export const CONTENT_CONTAINER_COLUMNS = [
  "id",
  "parentId",
  "name",
  "slug",
  "position",
  "createdAt",
  "updatedAt",
] as const;

export const CONTENT_CONTAINER_RESERVED_FIELDS = [
  ...CONTENT_CONTAINER_COLUMNS,
  "children",
  "definitionId",
  "depth",
  "metadata",
  "pluginId",
  "translations",
] as const;

export const CONTENT_CONTAINER_ORDERING_MODES = [
  "manual",
  "alphabetical",
] as const;

export const CONTENT_CONTAINER_DEFAULT_MAX_DEPTH = 5;

export const CONTENT_CONTAINER_ABSOLUTE_MAX_DEPTH = 10;

export const CONTENT_CONTAINER_NAME_MAX_LENGTH = 255;

export const CONTENT_CONTAINER_SLUG_MAX_LENGTH = 160;

export const CONTENT_CONTAINER_MAX_PER_DEFINITION = 5000;

export const CONTENT_CONTAINER_ERROR_CODES = [
  "cycle",
  "definitionMismatch",
  "hasChildren",
  "hasContent",
  "invalidIcon",
  "invalidInput",
  "invalidLocale",
  "invalidMetadata",
  "invalidPolicy",
  "invalidPosition",
  "limitReached",
  "maxDepth",
  "notFound",
  "parentNotFound",
  "slugEmpty",
  "slugTaken",
] as const;

export const CONTENT_CONTAINER_ICON_UPLOAD_ERROR_CODES = [
  "forbidden",
  "invalidFile",
  "notIconField",
  "storageUnavailable",
  "tooLarge",
  "unprocessable",
  "wrongType",
] as const;

export const CONTENT_CONTAINER_POLICY_CREATE = [
  "members",
  "moderators",
] as const;

export const CONTENT_CONTAINER_POLICY_MODES = ["immediate", "approve"] as const;

export const CONTENT_CONTAINER_POLICY_AUTHOR_EDIT = [
  "always",
  "never",
  "window",
] as const;

export const CONTENT_CONTAINER_POLICY_KEYS = [
  "create",
  "publish",
  "edits",
  "authorEdit",
  "authorEditMinutes",
] as const;

export const CONTENT_CONTAINER_POLICY_MAX_MINUTES = 60 * 24 * 365;

export const CONTENT_CONTAINER_TREE_SUFFIX = ":tree";

export const CONTENT_CONTAINER_LOCALIZED_FIELD_KINDS = [
  "text",
  "textarea",
] as const;
