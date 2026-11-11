import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

const submission = {
  authorId: z.number().int().nullable(),
  containerId: z.number().int().nullable(),
  contentId: z.string(),
  contentTypeId: z.string(),
  kind: z.enum(["create", "edit"]),
  pluginId: z.string(),
  submissionId: z.number().int(),
};

export const contentApprovalSubmittedEvent = defineEvent({
  pluginId,
  name: "content.approval.submitted",
  payload: z.object({
    ...submission,
    /** Id of the pending proposal this one replaced, if any. */
    replacedSubmissionId: z.number().int().nullable(),
  }),
});

export const contentApprovalApprovedEvent = defineEvent({
  pluginId,
  name: "content.approval.approved",
  payload: z.object({ ...submission, reviewerId: z.number().int() }),
});

export const contentApprovalRejectedEvent = defineEvent({
  pluginId,
  name: "content.approval.rejected",
  payload: z.object({
    ...submission,
    reason: z.string().nullable(),
    reviewerId: z.number().int(),
  }),
});

/** Every `content.approval.*` event core defines. */
export const contentApprovalEventDefinitions = [
  contentApprovalSubmittedEvent,
  contentApprovalApprovedEvent,
  contentApprovalRejectedEvent,
];
