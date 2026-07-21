import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const zodRebuildSearchSchema = z.object({
  // Rebuild a single collection; omit to rebuild the whole index.
  itemType: z.string().optional(),
});

export const rebuildSearchDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_view" },
  route: {
    method: "post",
    description:
      "Queue a rebuild of the content search index, optionally scoped to one collection.",
    path: "/search/rebuild",
    request: {
      body: {
        required: false,
        content: {
          "application/json": {
            schema: zodRebuildSearchSchema,
          },
        },
      },
    },
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
    const { itemType } = c.req.valid("json") ?? {};

    await c.get("queue").dispatch({
      name: "rebuild-search-index",
      payload: itemType ? { itemType } : {},
    });

    return c.json({ queued: true });
  },
});
