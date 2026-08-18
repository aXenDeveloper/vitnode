import { getColumns } from "drizzle-orm";
import z from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_cron } from "@/database/cron";

export const getCronsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "cron", permission: "can_view" },
  route: {
    method: "get",
    description: "Get Admin Cron Logs",
    path: "/",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["createdAt", "lastRun", "nextRun"]).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(
                z.object({
                  id: z.number(),
                  createdAt: z.date(),
                  name: z.string(),
                  description: z.string().nullable(),
                  pluginId: z.string(),
                  module: z.string(),
                  lastRun: z.date().nullable(),
                  nextRun: z.date().nullable(),
                  schedule: z.string(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "List of cron jobs",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const data = await withPagination({
      params: {
        query,
      },
      c,
      primaryCursor: core_cron.id,
      query: async ({ cursorSelection, limit, where, orderBy }) =>
        await c
          .get("db")
          .select({ ...getColumns(core_cron), ...cursorSelection })
          .from(core_cron)
          .where(where)
          .orderBy(orderBy)
          .limit(limit),
      table: core_cron,
      orderBy: {
        column: query.orderBy ? core_cron[query.orderBy] : core_cron.lastRun,
        order: query.order ?? "desc",
      },
    });

    return c.json(data);
  },
});
