/**
 * Where an audited operation was performed: the AdminCP, the ModeratorCP (or a
 * moderator tool on the public site), a member's own write on the public site,
 * or a background task with nobody behind it.
 */
export const AUDIT_AREAS = ["admin", "moderator", "public", "system"] as const;

export type AuditArea = (typeof AUDIT_AREAS)[number];

/**
 * The two staff logs of the AdminCP: moderators' (the `moderator` area) and
 * admins' (every other area, system and member activity included).
 */
export const AUDIT_STAFF_LOGS = ["admin", "moderator"] as const;

export type AuditStaffLog = (typeof AUDIT_STAFF_LOGS)[number];

/**
 * Who performed an audited operation: a staff member (admin or moderator), a
 * signed-in member writing through the public API, or the system itself. The
 * same vocabulary the Content Engine uses for its revisions.
 */
export const AUDIT_ACTOR_TYPES = ["staff", "api", "system"] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

/** The plugin id core records its own operations under. */
export const AUDIT_CORE_PLUGIN_ID = "@vitnode/core";

export const AUDIT_PLUGIN_ID_MAX_LENGTH = 255;
export const AUDIT_ACTION_MAX_LENGTH = 150;
export const AUDIT_TARGET_TYPE_MAX_LENGTH = 100;
export const AUDIT_TARGET_ID_MAX_LENGTH = 64;
export const AUDIT_TARGET_LABEL_MAX_LENGTH = 255;
export const AUDIT_SCOPE_FAMILY_MAX_LENGTH = 100;
export const AUDIT_SCOPE_ID_MAX_LENGTH = 64;

/**
 * Stable, lowercase, dot-separated identifiers: `category.updated`,
 * `report.status_changed`, `content.translation_published`.
 */
export const AUDIT_ACTION_PATTERN = /^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/;

/**
 * A target type uses the same alphabet: `category`, `report`, or a content
 * type id such as `blog.category`.
 */
export const AUDIT_TARGET_TYPE_PATTERN = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/;

/** Longest string a change or metadata value keeps before it is cut. */
export const AUDIT_STRING_MAX_LENGTH = 500;
/** Most fields one `changes` object keeps. */
export const AUDIT_CHANGES_MAX_FIELDS = 50;
/** Most keys one metadata object (at any depth) keeps. */
export const AUDIT_OBJECT_MAX_KEYS = 50;
/** Most items an array keeps. */
export const AUDIT_ARRAY_MAX_ITEMS = 50;
/** How deep a nested value is followed before it is summarised. */
export const AUDIT_MAX_DEPTH = 4;
/** Serialized budget of `changes`, and separately of `metadata`, in bytes. */
export const AUDIT_JSON_MAX_BYTES = 16_384;

/** What a value is replaced with when it must never be stored. */
export const AUDIT_REDACTED = "[redacted]";
/** What a value is replaced with when it is too large to be worth storing. */
export const AUDIT_TRUNCATED = "[truncated]";
/** What a rich-text document is stored as: the revision has the document. */
export const AUDIT_RICH_TEXT = "[rich text]";

/** Retention choices offered in the AdminCP, in days. `0` keeps everything. */
export const AUDIT_RETENTION_DAYS_OPTIONS = [0, 30, 90, 180, 365, 730] as const;
export const AUDIT_DEFAULT_RETENTION_DAYS = 365;
/** Rows the retention job deletes per statement, so a backlog never locks the table. */
export const AUDIT_RETENTION_BATCH_SIZE = 5_000;
/** Most rows one CSV export contains. */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

/** A single before/after transition of one field. */
export interface AuditChange {
  from?: unknown;
  /**
   * `true` when the field is sensitive: the change is recorded, its values are
   * not.
   */
  redacted?: true;
  to?: unknown;
}

/** Structured before/after changes, keyed by field name. */
export type AuditChanges = Record<string, AuditChange>;

/** The scope a moderation operation belongs to, as the moderation registry names it. */
export interface AuditScope {
  family: string;
  id: number | string;
}

/** The resource an audited operation acted on. */
export interface AuditTarget {
  /** Numeric and string ids are both stored as text. `null` for a singleton (settings). */
  id?: null | number | string;
  /**
   * A short human-readable name, kept so the entry still reads well after the
   * resource is deleted. Not personal data beyond what the resource shows.
   */
  label?: null | string;
  /** `category`, `role`, `report`, `settings`... */
  type: string;
}
