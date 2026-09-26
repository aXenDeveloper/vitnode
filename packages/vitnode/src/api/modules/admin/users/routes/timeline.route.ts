import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { zodSearchResultSchema } from "@/api/modules/search/routes/search.route";
import {
  searchTimeline,
  zodSearchTimelineQuery,
  zodSearchTimelineUserId,
} from "@/api/modules/search/routes/timeline.route";
import { CONFIG_PLUGIN } from "@/config";

export const timelineUserAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Indexed content credited to one user in every state, drafts included (Admin only)",
    path: "/{id}/timeline",
    request: {
      params: z.object({ id: zodSearchTimelineUserId }),
      query: zodSearchTimelineQuery,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodSearchResultSchema,
          },
        },
        description: "Timeline",
      },
    },
  },
  handler: async c => {
    const result = await searchTimeline(c, {
      authorId: Number(c.req.valid("param").id),
      includePrivate: true,
      query: c.req.valid("query"),
    });

    return c.json(result, 200);
  },
});
