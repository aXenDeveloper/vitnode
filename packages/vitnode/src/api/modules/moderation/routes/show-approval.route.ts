import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { showContentSubmission } from "@/content/approvals/server/queue";

import { decisionErrorSchema, idParams, itemSchema } from "../approvals.schema";
import { reviewableSubmission } from "../lib/approvals";
import { json } from "../moderation.schema";

const detailSchema = itemSchema.extend({
  baseValues: z.record(z.string(), z.unknown()).nullable(),
  current: z.record(z.string(), z.unknown()).nullable(),
  fields: z.array(z.object({ kind: z.string(), name: z.string() })),
  history: z.array(itemSchema),
  record: z.object({
    exists: z.boolean(),
    public: z.boolean(),
    slug: z.string().nullable(),
    url: z.string().nullable(),
  }),
  values: z.record(z.string(), z.unknown()),
});

export const showApprovalRoute = buildRoute({
  route: {
    method: "get",
    path: "/approvals/{id}",
    description:
      "One submission with the proposed values, the live record to compare with, and its history",
    request: { params: idParams },
    responses: {
      200: json(detailSchema, "The submission"),
      401: { description: "Sign in first" },
      403: { description: "Not a moderator" },
      404: json(decisionErrorSchema, "No such submission in your scope"),
    },
  },
  handler: async c => {
    const { row } = await reviewableSubmission(c, c.req.valid("param").id);

    return c.json(await showContentSubmission(c, row), 200, {
      "Cache-Control": "private, no-store",
    });
  },
});
