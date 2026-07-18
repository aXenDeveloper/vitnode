import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const rebuildSearchDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_view" },
  route: {
    method: "post",
    description: "Queue a full rebuild of the content search index.",
    path: "/search/rebuild",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ queued: z.boolean() }),
          },
        },
        description: "Rebuild queued",
      },
    },
  },
  handler: async c => {
    await c.get("queue").dispatch({ name: "rebuild-search-index" });

    return c.json({ queued: true });
  },
});
