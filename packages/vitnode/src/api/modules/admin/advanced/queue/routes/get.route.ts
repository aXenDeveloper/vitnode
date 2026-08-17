import { getColumns, inArray } from "drizzle-orm";
import z from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";
import { CONFIG_PLUGIN } from "@/config";
import { core_queue } from "@/database/queue";

const QUEUE_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export const getQueueTasksRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "queue", permission: "can_view" },
  route: {
    method: "get",
    description: "Get Admin Queue Tasks",
    path: "/",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["createdAt", "availableAt", "status"]).optional(),
        status: z.string().optional(),
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
                  pluginId: z.string(),
                  name: z.string(),
                  queue: z.string(),
                  status: z.enum(QUEUE_STATUSES),
                  priority: z.number(),
                  attempts: z.number(),
                  maxAttempts: z.number(),
                  availableAt: z.date(),
                  reservedAt: z.date().nullable(),
                  lastError: z.string().nullable(),
                  createdAt: z.date(),
                  completedAt: z.date().nullable(),
                }),
              ),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "List of queue tasks",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");
    const statuses = (query.status?.split(",") ?? []).filter(
      (status): status is (typeof QUEUE_STATUSES)[number] =>
        (QUEUE_STATUSES as readonly string[]).includes(status),
    );

    const data = await withPagination({
      params: { query },
      c,
      primaryCursor: core_queue.id,
      where: statuses.length ? inArray(core_queue.status, statuses) : undefined,
      query: async ({ cursorSelection, limit, where, orderBy }) =>
        await c
          .get("db")
          .select({ ...getColumns(core_queue), ...cursorSelection })
          .from(core_queue)
          .where(where)
          .orderBy(orderBy)
          .limit(limit),
      table: core_queue,
      orderBy: {
        column: query.orderBy
          ? core_queue[query.orderBy]
          : core_queue.createdAt,
        order: query.order ?? "desc",
      },
    });

    return c.json(data);
  },
});
