import { count, max } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_search_index } from "@/database/search";

export const searchStatusDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_view" },
  route: {
    method: "get",
    description: "Report the active search engine, its health, and index stats.",
    path: "/search/status",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              engine: z.string(),
              healthy: z.boolean(),
              total: z.number(),
              lastIndexedAt: z.date().nullable(),
              types: z.array(
                z.object({ itemType: z.string(), count: z.number() }),
              ),
            }),
          },
        },
        description: "Search engine status",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const search = c.get("search");

    const [totals] = await db
      .select({
        total: count(),
        lastIndexedAt: max(core_search_index.indexedAt),
      })
      .from(core_search_index);

    const types = await db
      .select({ itemType: core_search_index.itemType, count: count() })
      .from(core_search_index)
      .groupBy(core_search_index.itemType);

    return c.json({
      engine: search.name(),
      healthy: await search.ping(),
      total: totals.total,
      lastIndexedAt: totals.lastIndexedAt,
      types,
    });
  },
});
