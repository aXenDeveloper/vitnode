export const CONTENT_SUBMISSION_KINDS = ["create", "edit"] as const;

export type ContentSubmissionKind = (typeof CONTENT_SUBMISSION_KINDS)[number];

/**
 * `pending` waits for a moderator. `superseded` was replaced by the author's
 * newer proposal, `cancelled` lost its record before anyone decided.
 */
export const CONTENT_SUBMISSION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "superseded",
  "cancelled",
] as const;

export type ContentSubmissionStatus =
  (typeof CONTENT_SUBMISSION_STATUSES)[number];

export const CONTENT_SUBMISSION_DECISION_CODES = [
  "decided",
  "forbidden",
  "gone",
  "notFound",
  "stale",
] as const;

export type ContentSubmissionDecisionCode =
  (typeof CONTENT_SUBMISSION_DECISION_CODES)[number];

export const CONTENT_SUBMISSION_LIMITS = {
  pageSize: 25,
  maxPageSize: 100,
  reasonMaxLength: 2000,
} as const;
