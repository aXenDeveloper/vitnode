/**
 * What an access policy decides, in prerequisite order: each action needs the
 * one before it (`read` needs `view`, `comment` and `downloadAttachments` need
 * `read`).
 */
export const CONTENT_ACCESS_ACTIONS = [
  "view",
  "read",
  "comment",
  "downloadAttachments",
] as const;

export const CONTENT_ACCESS_MODES = ["everyone", "members", "roles"] as const;

/** The action each action needs first, or `null` for `view`. */
export const CONTENT_ACCESS_PREREQUISITES = {
  view: null,
  read: "view",
  comment: "read",
  downloadAttachments: "read",
} as const;

/** The most roles one audience may list. */
export const CONTENT_ACCESS_MAX_ROLES = 100;

/** The most scopes one effective-access check takes. */
export const CONTENT_ACCESS_MAX_EFFECTIVE_SCOPES = 50;

/** The JSON error codes the access admin routes answer with. */
export const CONTENT_ACCESS_ERROR_CODES = [
  "invalidAccess",
  "notFound",
  "unknownRole",
  "unsupportedStorage",
] as const;

/**
 * The header a public detail route sets when a record exists in a scope the
 * viewer may see but not read. The body is the limited `{ accessRequired }`
 * shape, never the record.
 */
export const CONTENT_ACCESS_REQUIRED_CODE = "CONTENT_ACCESS_REQUIRED";
