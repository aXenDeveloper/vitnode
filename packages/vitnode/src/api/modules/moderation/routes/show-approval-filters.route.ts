import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";
import { contentSubmissionFilters } from "@/content/approvals/server/queue";

import { json } from "../moderation.schema";

export const approvalFiltersRoute = buildRoute({
  route: {
    method: "get",
    path: "/approvals/filters",
    description:
      "Content types and containers the moderator may review, for the queue filters",
    responses: {
      200: json(
        z.object({
          containers: z.array(
            z.object({
              definitionId: z.string(),
              depth: z.number(),
              id: z.number(),
              name: z.string(),
            }),
          ),
          contentTypes: z.array(
            z.object({ id: z.string(), pluginId: z.string() }),
          ),
        }),
        "Filter options",
      ),
      401: { description: "Sign in first" },
      403: { description: "Not a moderator" },
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);

    return c.json(await contentSubmissionFilters(c, moderator.set), 200, {
      "Cache-Control": "private, no-store",
    });
  },
});
