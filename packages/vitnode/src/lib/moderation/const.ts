export const MODERATION_PERMISSIONS = {
  viewReports: "can_view_reports",
  manageReports: "can_manage_reports",
  editNotes: "can_edit_notes",
  deleteNotes: "can_delete_notes",
  viewHidden: "can_view_hidden",
  hide: "can_hide",
  warn: "can_warn",
} as const;

export const MODERATION_DEFAULT_REPORT_REASONS = [
  {
    code: "spam",
    description: "Advertising, scams or repeated junk.",
    requiresDetails: false,
    title: "Spam",
  },
  {
    code: "abusive",
    description: "Harassment, hate or threats.",
    requiresDetails: false,
    title: "Abusive content",
  },
  {
    code: "rule_violation",
    description: "Breaks the community rules in another way.",
    requiresDetails: false,
    title: "Rule violation",
  },
  {
    code: "other",
    description: "Something else - tell us what.",
    requiresDetails: true,
    title: "Other",
  },
] as const;

export const MODERATION_REPORT_STATUSES = [
  "new",
  "in_progress",
  "done",
] as const;

export type ModerationReportStatus =
  (typeof MODERATION_REPORT_STATUSES)[number];

export const MODERATION_REPORT_RESOLUTIONS = [
  "no_violation",
  "action_taken",
  "duplicate",
] as const;

export type ModerationReportResolution =
  (typeof MODERATION_REPORT_RESOLUTIONS)[number];

export const MODERATION_REPORT_EVENT_TYPES = [
  "created",
  "assigned",
  "unassigned",
  "status_changed",
  "note",
  "note_edited",
  "note_deleted",
  "action",
  "resolved",
  "reopened",
  "warning",
] as const;

export type ModerationReportEventType =
  (typeof MODERATION_REPORT_EVENT_TYPES)[number];

export const MODERATION_TARGET_ACTIONS = ["hide", "unhide"] as const;

export type ModerationTargetAction = (typeof MODERATION_TARGET_ACTIONS)[number];

export const MODERATION_LIMITS = {
  descriptionMaxLength: 2000,
  requiredDescriptionMinLength: 10,
  reasonTitleMaxLength: 100,
  reasonDescriptionMaxLength: 255,
  maxReportReasons: 10,
  noteMaxLength: 2000,
  explanationMinLength: 3,
  richNoteMaxBytes: 64 * 1024,
  snapshotMaxBytes: 256 * 1024,
  snapshotTextMaxLength: 20_000,
  reportsPerUserPerHour: 20,
  queuePageSize: 25,
} as const;

export const MODERATION_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export const MODERATION_RESOURCE_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export const MODERATION_SNAPSHOT_VERSION = 1;
