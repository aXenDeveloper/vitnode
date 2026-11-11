import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { searchTimeline } from "@/api/modules/search/lib/timeline";
import {
  zodSearchResultSchema,
  zodSearchTimelineQuery,
  zodSearchTimelineUserId,
} from "@/api/modules/search/search.schema";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

export const timelineUserAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.users.canView,
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
      // A staff route behind `users:can_view`: the AdminCP sees every item,
      // whatever the scopes it is filed in allow on the public site.
      skipAccess: true,
      query: c.req.valid("query"),
    });

    return c.json(result, 200);
  },
});
