import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { CONTENT_SUBMISSION_LIMITS } from "@/content/approvals/const";
import { decideContentSubmission } from "@/content/approvals/server/decide";

import { decisionResponses, idParams } from "../approvals.schema";
import { decisionError, reviewableSubmission } from "../lib/approvals";

export const rejectApprovalRoute = buildRoute({
  route: {
    method: "post",
    path: "/approvals/{id}/reject",
    description:
      "Reject a submission. The record stays as it is: a new one stays unpublished, a published one keeps its live version",
    request: {
      params: idParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              reason: z
                .string()
                .trim()
                .max(CONTENT_SUBMISSION_LIMITS.reasonMaxLength)
                .nullable()
                .optional(),
            }),
          },
        },
      },
    },
    responses: decisionResponses,
  },
  handler: async c => {
    const { moderator, row } = await reviewableSubmission(
      c,
      c.req.valid("param").id,
    );
    const { reason } = c.req.valid("json");

    try {
      const decided = await decideContentSubmission(c, {
        decision: "reject",
        id: row.id,
        reason: reason === "" ? null : (reason ?? null),
        reviewerId: moderator.user.id,
      });

      return c.json({ id: decided.id, status: decided.status }, 200);
    } catch (error) {
      return decisionError(error);
    }
  },
});
