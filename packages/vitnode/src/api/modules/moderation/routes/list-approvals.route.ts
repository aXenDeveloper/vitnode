import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";
import { CONTENT_SUBMISSION_STATUSES } from "@/content/approvals/const";
import { listContentSubmissions } from "@/content/approvals/server/queue";

import { pageQuery, pageSchema } from "../approvals.schema";
import { json } from "../moderation.schema";

export const listApprovalsRoute = buildRoute({
  route: {
    method: "get",
    path: "/approvals",
    description:
      "The approval queue - only submissions in containers where the moderator holds `can_approve`",
    request: {
      query: z.object({
        ...pageQuery,
        status: z.enum(CONTENT_SUBMISSION_STATUSES).default("pending"),
        contentTypeId: z.string().max(100).optional(),
        containerId: z.coerce.number().int().positive().optional(),
      }),
    },
    responses: {
      200: json(pageSchema, "One page of submissions"),
      401: { description: "Sign in first" },
      403: { description: "Not a moderator" },
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const query = c.req.valid("query");
    const { items, total } = await listContentSubmissions(
      c,
      moderator.set,
      query,
    );

    return c.json(
      { items, page: query.page, pageSize: query.pageSize, total },
      200,
      { "Cache-Control": "private, no-store" },
    );
  },
});
