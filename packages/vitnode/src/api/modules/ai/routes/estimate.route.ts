import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { zodAiRunBody } from "@/api/lib/ai/run.schema";

export const estimateAiRoute = buildRoute({
  route: {
    method: "post",
    description:
      "The most a run could cost you, before running it. An upper bound, not a price.",
    path: "/estimate",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodAiRunBody } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              maxPoints: z.string().nullable(),
              maxUsd: z.string().nullable(),
            }),
          },
        },
        description: "Upper bound",
      },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const estimate = await c.get("ai").estimate({
      ...body,
      resource: body.resource ?? undefined,
    });

    return c.json(estimate, 200);
  },
});
