import { buildRoute } from "@/api/builders";
import { decideContentSubmission } from "@/content/approvals/server/decide";

import { decisionResponses, idParams } from "../approvals.schema";
import { decisionError, reviewableSubmission } from "../lib/approvals";

export const approveApprovalRoute = buildRoute({
  route: {
    method: "post",
    path: "/approvals/{id}/approve",
    description:
      "Approve a submission: publish the new record, or apply the proposed edit",
    request: { params: idParams },
    responses: decisionResponses,
  },
  handler: async c => {
    const { moderator, row } = await reviewableSubmission(
      c,
      c.req.valid("param").id,
    );

    try {
      const decided = await decideContentSubmission(c, {
        decision: "approve",
        id: row.id,
        reviewerId: moderator.user.id,
      });

      return c.json({ id: decided.id, status: decided.status }, 200);
    } catch (error) {
      return decisionError(error);
    }
  },
});
