import { HTTPException } from "hono/http-exception";
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
      404: { description: "No indexer is registered for that collection" },
    },
  },
  handler: async c => {
    const { itemType } = c.req.valid("json") ?? {};

    // A rebuild of a collection with no indexer would clear it and refill
    // nothing, so it is refused here rather than queued and discovered later.
    // The task repeats the check for callers that bypass this route.
    if (
      itemType &&
      !c.get("core").searchIndexers.some(i => i.itemType === itemType)
    ) {
      throw new HTTPException(404, {
        message: `No search indexer is registered for "${itemType}".`,
      });
    }

    await c.get("queue").dispatch({
      name: "rebuild-search-index",
      payload: itemType ? { itemType } : {},
    });

    return c.json({ queued: true });
  },
});
