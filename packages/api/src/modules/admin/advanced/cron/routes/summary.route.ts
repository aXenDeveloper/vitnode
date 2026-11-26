import { and, count, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/builders";
import { core_queue } from "@/database/queue";
import { checkStaffPermission } from "@/lib/check-staff-permission";
import { isCronSecretRejected } from "@/lib/config";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { loadCronHealth } from "@/modules/cron/lib/load-cron-health";

const DAY_MS = 86_400_000;
const RUNNING_JOBS_LIMIT = 3;
const FAILED_JOBS_LIMIT = 2;

export const zodCronSummary = z.object({
  active: z.boolean(),
  queue: z
    .object({
      completedLastDay: z.number(),
      failed: z.number(),
      failedJobs: z.array(
        z.object({
          failedAt: z.string(),
          id: z.number(),
          lastError: z.string().nullable(),
          name: z.string(),
        }),
      ),
      pending: z.number(),
      processing: z.number(),
      runningJobs: z.array(
        z.object({
          attempts: z.number(),
          id: z.number(),
          maxAttempts: z.number(),
          name: z.string(),
          startedAt: z.string(),
        }),
      ),
    })
    .nullable(),
  scheduler: z.object({
    lastRun: z.string().nullable(),
    nextRun: z.string().nullable(),
    overdueTasks: z.number(),
    stale: z.boolean(),
  }),
  secretRejected: z.boolean(),
});

const queueCanView = coreStaffPermissions.admin.queue.canView;

export const getCronSummaryRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.cron.canView,
  route: {
    method: "get",
    description:
      "The scheduler's health and, for staff who may view the queue, the queue's counts, running jobs and latest failed jobs (Admin only)",
    path: "/summary",
    responses: {
      200: {
        content: { "application/json": { schema: zodCronSummary } },
        description: "Scheduler and queue summary",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const now = new Date();
    const [health, canViewQueue] = await Promise.all([
      loadCronHealth(db),
      checkStaffPermission(c, {
        module: queueCanView.module,
        permission: queueCanView.permission,
        plugin: queueCanView.plugin,
        type: "admin",
      }),
    ]);

    const queue = canViewQueue
      ? await (async () => {
          const [byStatus, [completed], runningJobs, failedJobs] =
            await Promise.all([
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
                    gte(
                      core_queue.completedAt,
                      new Date(now.getTime() - DAY_MS),
                    ),
                  ),
                ),
              db
                .select({
                  attempts: core_queue.attempts,
                  id: core_queue.id,
                  maxAttempts: core_queue.maxAttempts,
                  name: core_queue.name,
                  reservedAt: core_queue.reservedAt,
                  updatedAt: core_queue.updatedAt,
                })
                .from(core_queue)
                .where(eq(core_queue.status, "processing"))
                .orderBy(core_queue.reservedAt)
                .limit(RUNNING_JOBS_LIMIT),
              db
                .select({
                  id: core_queue.id,
                  lastError: core_queue.lastError,
                  name: core_queue.name,
                  updatedAt: core_queue.updatedAt,
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
            failedJobs: failedJobs.map(({ updatedAt, ...job }) => ({
              ...job,
              failedAt: updatedAt.toISOString(),
            })),
            pending: total("pending"),
            processing: total("processing"),
            runningJobs: runningJobs.map(
              ({ reservedAt, updatedAt, ...job }) => ({
                ...job,
                startedAt: (reservedAt ?? updatedAt).toISOString(),
              }),
            ),
          };
        })()
      : null;

    return c.json(
      {
        active: c.get("core").hasCronAdapter,
        queue,
        scheduler: {
          lastRun: health.lastRun?.toISOString() ?? null,
          nextRun: health.nextRun?.toISOString() ?? null,
          overdueTasks: health.overdueJobs,
          stale: health.stale,
        },
        secretRejected: isCronSecretRejected(c.get("core").cronSecret),
      },
      200,
    );
  },
});
