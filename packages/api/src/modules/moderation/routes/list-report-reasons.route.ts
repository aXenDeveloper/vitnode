import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import {
  listReportReasons,
  reportReasonSchema,
} from "@/lib/moderation/report-reasons";

import { json } from "../moderation.schema";

export const listReportReasonsRoute = buildRoute({
  route: {
    method: "get",
    path: "/reasons",
    description:
      "The reasons a member can pick when reporting something, in display order, with every translation",
    responses: {
      200: json(
        z.object({
          reasons: z.array(reportReasonSchema.omit({ position: true })),
        }),
        "Report reasons",
      ),
    },
  },
  handler: async c => {
    const reasons = await listReportReasons(c);

    return c.json(
      { reasons: reasons.map(({ position: _position, ...reason }) => reason) },
      200,
    );
  },
});
