export const BLOCK_NAMESPACE_SEPARATOR = ":";

export const BLOCK_WILDCARD = "*";

export const BLOCK_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const BLOCK_NAMESPACE_PATTERN = BLOCK_NAME_PATTERN;

export const BLOCK_ID_MAX_LENGTH = 64;

export const BLOCK_INSTANCE_ID_LENGTH = 26;

export const BLOCK_INSTANCE_ID_MAX_LENGTH = 64;

export const BLOCK_INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const BLOCK_FIELD_KINDS = [
  "boolean",
  "dateTime",
  "enum",
  "group",
  "number",
  "text",
  "textarea",
] as const;

const blockFieldKinds: ReadonlySet<string> = new Set(BLOCK_FIELD_KINDS);

export const isBlockFieldKind = (kind: string): boolean =>
  blockFieldKinds.has(kind);

export const CONTENT_BLOCKS_DEFAULT_MAX = 200;

export const CONTENT_BLOCKS_ABSOLUTE_MAX = 1000;
