import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const zodClearSearchSchema = z.object({
  itemType: z.string().min(1),
});

/**
 * Deletes the documents of one orphaned collection.
 *
 * Deliberately not part of `/search/rebuild`: this removes documents and puts
 * nothing back, so it must not hide behind an action called "reindex". It is
 * refused for a collection that *does* have an indexer - that one has a rebuild,
 * which is the non-destructive way to get the same freshness.
 *
 * `itemType` is required and non-empty, so there is no payload that clears the
 * whole index by omission. A full rebuild is the only thing that does that, and
 * it refills what it clears.
 */
export const clearSearchDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_view" },
  route: {
    method: "post",
    description:
      "Permanently remove the indexed documents of one collection that has no registered search indexer.",
    path: "/search/clear",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodClearSearchSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ cleared: z.boolean() }),
          },
        },
        description: "Collection cleared",
      },
      409: { description: "The collection still has a registered indexer" },
    },
  },
  handler: async c => {
    const { itemType } = c.req.valid("json");

    if (c.get("core").searchIndexers.some(i => i.itemType === itemType)) {
      throw new HTTPException(409, {
        message: `"${itemType}" still has a registered search indexer. Rebuild it instead of deleting its documents.`,
      });
    }

    await c.get("search").clear(itemType);

    await c
      .get("log")
      .warn(
        `[Search] Removed the indexed documents of orphaned collection "${itemType}".`,
      );

    return c.json({ cleared: true });
  },
});
