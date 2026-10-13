import { z } from "zod";

import type { ContentSubmissionKind, ContentSubmissionStatus } from "./const";

import { CONTENT_SUBMISSION_KINDS, CONTENT_SUBMISSION_STATUSES } from "./const";

/** What a public-write response tells its author about moderation. */
export interface ContentApprovalState {
  id: number;
  kind: ContentSubmissionKind;
  /** Why a moderator said no. Only on a rejection. */
  reason: null | string;
  status: ContentSubmissionStatus;
  submittedAt: Date;
  /** The proposed values of an edit still waiting for a moderator. */
  values: null | Record<string, unknown>;
}

export const zodContentApprovalState = z.object({
  id: z.number(),
  kind: z.enum(CONTENT_SUBMISSION_KINDS),
  reason: z.string().nullable(),
  status: z.enum(CONTENT_SUBMISSION_STATUSES),
  submittedAt: z.coerce.date(),
  values: z.record(z.string(), z.unknown()).nullable(),
});
