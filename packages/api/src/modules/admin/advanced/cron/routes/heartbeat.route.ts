import { and, count, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { core_queue } from "@/database/queue";
import { checkStaffPermission } from "@/lib/check-staff-permission";
import { isCronSecretRejected } from "@/lib/config";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { loadCronHeartbeat } from "@/modules/cron/lib/heartbeat";
import { loadCronHealth } from "@/modules/cron/lib/load-cron-health";

const DAY_MS = 86_400_000;
const FAILED_JOBS_LIMIT = 3;

export const zodCronHeartbeat = z.object({
  active: z.boolean(),
  lastRun: z.string().nullable(),
  overdueJobs: z.number(),
  queue: z
    .object({
      completedLastDay: z.number(),
      failed: z.number(),
      failedJobs: z.array(
        z.object({
          createdAt: z.string(),
          id: z.number(),
          lastError: z.string().nullable(),
          name: z.string(),
        }),
      ),
      pending: z.number(),
      processing: z.number(),
    })
    .nullable(),
  secretRejected: z.boolean(),
  slots: z.array(
    z.object({
      slot: z.string(),
      state: z.enum(["missed", "none", "ran"]),
    }),
  ),
  stale: z.boolean(),
});

const queueCanView = coreStaffPermissions.admin.queue.canView;

export const getCronHeartbeatRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.cron.canView,
  route: {
    method: "get",
    description:
      "The scheduler's last 24 hours in half-hour slots, its health and, for staff who may view the queue, the queue's counts and latest failed jobs (Admin only)",
    path: "/heartbeat",
    responses: {
      200: {
        content: { "application/json": { schema: zodCronHeartbeat } },
        description: "Scheduler heartbeat",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const now = new Date();
    const [health, slots, canViewQueue] = await Promise.all([
      loadCronHealth(db),
      loadCronHeartbeat(db, now),
      checkStaffPermission(c, {
        module: queueCanView.module,
        permission: queueCanView.permission,
        plugin: queueCanView.plugin,
        type: "admin",
      }),
    ]);

    const queue = canViewQueue
      ? await (async () => {
          const [byStatus, [completed], failedJobs] = await Promise.all([
            db
              .select({ status: core_queue.status, total: count() })
              .from(core_queue)
              .groupBy(core_queue.status),
            db
              .select({ total: count() })
              .from(core_queue)
              .where(
                and(
                  eq(core_queue.status, "completed"),
                  gte(core_queue.completedAt, new Date(now.getTime() - DAY_MS)),
                ),
              ),
            db
              .select({
                createdAt: core_queue.createdAt,
                id: core_queue.id,
                lastError: core_queue.lastError,
                name: core_queue.name,
              })
              .from(core_queue)
              .where(eq(core_queue.status, "failed"))
              .orderBy(desc(core_queue.updatedAt))
              .limit(FAILED_JOBS_LIMIT),
          ]);
          const total = (status: string) =>
            byStatus.find(row => row.status === status)?.total ?? 0;

          return {
            completedLastDay: completed?.total ?? 0,
            failed: total("failed"),
            failedJobs: failedJobs.map(job => ({
              ...job,
              createdAt: job.createdAt.toISOString(),
            })),
            pending: total("pending"),
            processing: total("processing"),
          };
        })()
      : null;

    return c.json(
      {
        active: c.get("core").hasCronAdapter,
        lastRun: health.lastRun?.toISOString() ?? null,
        overdueJobs: health.overdueJobs,
        queue,
        secretRejected: isCronSecretRejected(c.get("core").cronSecret),
        slots: slots.map(({ slot, state }) => ({
          slot: slot.toISOString(),
          state,
        })),
        stale: health.stale,
      },
      200,
    );
  },
});
