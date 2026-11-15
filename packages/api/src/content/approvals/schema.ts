import { z } from "zod";

import type { ContentSubmissionKind, ContentSubmissionStatus } from "./const";

import { CONTENT_SUBMISSION_KINDS, CONTENT_SUBMISSION_STATUSES } from "./const";

/**
 * What a public-write response tells its author about moderation, as
 * `approval`. `null` there means nothing waits and the write is live.
 */
export interface ContentApprovalState {
  /** The submission's id. */
  id: number;
  /** `create` for a new record waiting to go live, `edit` for a proposal. */
  kind: ContentSubmissionKind;
  /** Why a moderator said no. Only on a rejection. */
  reason: null | string;
  /**
   * `pending` while a moderator has not decided; `rejected` until the author
   * edits again. A public write answers with the record's latest submission.
   */
  status: ContentSubmissionStatus;
  submittedAt: Date;
  /** The proposed values of an edit still waiting for a moderator. */
  values: null | Record<string, unknown>;
}

/**
 * Validates a {@link ContentApprovalState}, such as `approval` in a
 * `GET /{id}/edit` response. `submittedAt` is coerced to a `Date`.
 */
export const zodContentApprovalState = z.object({
  id: z.number(),
  kind: z.enum(CONTENT_SUBMISSION_KINDS),
  reason: z.string().nullable(),
  status: z.enum(CONTENT_SUBMISSION_STATUSES),
  submittedAt: z.coerce.date(),
  values: z.record(z.string(), z.unknown()).nullable(),
});
