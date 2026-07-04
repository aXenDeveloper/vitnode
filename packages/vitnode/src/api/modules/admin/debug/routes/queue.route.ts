import { asc, desc, inArray, sql } from "drizzle-orm";
import z from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_queue } from "@/database/queue";

const QUEUE_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export const queueDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "debug", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Currently active (pending/processing) queue tasks and per-status counts.",
    path: "/queue",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              counts: z.object({
                pending: z.number(),
                processing: z.number(),
                completed: z.number(),
                failed: z.number(),
              }),
              active: z.array(
                z.object({
                  id: z.number(),
                  name: z.string(),
                  pluginId: z.string(),
                  queue: z.string(),
                  status: z.enum(QUEUE_STATUSES),
                  attempts: z.number(),
                  maxAttempts: z.number(),
                  availableAt: z.date(),
                  createdAt: z.date(),
                }),
              ),
            }),
          },
        },
        description: "Queue status",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");

    const grouped = await db
      .select({
        status: core_queue.status,
        count: sql<number>`count(*)::int`,
      })
      .from(core_queue)
      .groupBy(core_queue.status);

    const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const row of grouped) {
      if (row.status in counts) {
        counts[row.status] = row.count;
      }
    }

    const active = await db
      .select({
        id: core_queue.id,
        name: core_queue.name,
        pluginId: core_queue.pluginId,
        queue: core_queue.queue,
        status: core_queue.status,
        attempts: core_queue.attempts,
        maxAttempts: core_queue.maxAttempts,
        availableAt: core_queue.availableAt,
        createdAt: core_queue.createdAt,
      })
      .from(core_queue)
      .where(inArray(core_queue.status, ["pending", "processing"]))
      .orderBy(desc(core_queue.priority), asc(core_queue.availableAt))
      .limit(50);

    return c.json({ counts, active }, 200);
  },
});
