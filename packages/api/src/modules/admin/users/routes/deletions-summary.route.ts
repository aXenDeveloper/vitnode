import { z } from "@hono/zod-openapi";
import { and, asc, count, eq, gte, inArray, lt, min } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_users_deletions } from "@/database/account-deletions";
import { core_cron } from "@/database/cron";
import { core_users } from "@/database/users";
import { getNextCronRunDate } from "@/lib/api/get-next-cron-run-date";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { manifest } from "@/manifest";
import { accountDeletionCron } from "@/modules/cron/cron/account-deletion.cron";

/** GDPR Art. 12(3): a request is answered within a month. */
export const ACCOUNT_DELETION_DEADLINE_DAYS = 30;

const DAY_MS = 86_400_000;
const ATTENTION_LIMIT = 20;

export const accountDeletionsSummaryAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.users.canView,
  route: {
    method: "get",
    description:
      "How account deletion is doing, for the Debug Panel: counts, the oldest open request against the one-month GDPR deadline, the requests that need staff (failed, or past their grace period) and the hourly job (Admin only)",
    path: "/account-deletions/summary",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              attention: z.array(
                z.object({
                  attempts: z.number(),
                  id: z.number(),
                  lastError: z.string().nullable(),
                  scheduledAt: z.date(),
                  status: z.enum(["pending", "failed"]),
                  user: z
                    .object({ id: z.number(), name: z.string() })
                    .nullable(),
                }),
              ),
              deadlineDays: z.number(),
              erasedLast30Days: z.number(),
              failed: z.number(),
              job: z.object({
                lastRun: z.date().nullable(),
                nextRun: z.date().nullable(),
              }),
              nextScheduledAt: z.date().nullable(),
              oldestOpenAt: z.date().nullable(),
              overdue: z.number(),
              pending: z.number(),
            }),
          },
        },
        description: "Account deletion health",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const now = new Date();
    const open = inArray(core_users_deletions.status, ["pending", "failed"]);
    const overdue = and(
      eq(core_users_deletions.status, "pending"),
      lt(core_users_deletions.scheduledAt, now),
    );

    const [
      byStatus,
      [oldest],
      [next],
      [erased],
      [overdueCount],
      attention,
      [job],
    ] = await Promise.all([
      db
        .select({ status: core_users_deletions.status, total: count() })
        .from(core_users_deletions)
        .where(open)
        .groupBy(core_users_deletions.status),
      db
        .select({ at: min(core_users_deletions.createdAt) })
        .from(core_users_deletions)
        .where(open),
      db
        .select({ at: min(core_users_deletions.scheduledAt) })
        .from(core_users_deletions)
        .where(
          and(
            eq(core_users_deletions.status, "pending"),
            gte(core_users_deletions.scheduledAt, now),
          ),
        ),
      db
        .select({ total: count() })
        .from(core_users_deletions)
        .where(
          and(
            eq(core_users_deletions.status, "completed"),
            gte(
              core_users_deletions.completedAt,
              new Date(now.getTime() - 30 * DAY_MS),
            ),
          ),
        ),
      db.select({ total: count() }).from(core_users_deletions).where(overdue),
      db
        .select({
          attempts: core_users_deletions.attempts,
          id: core_users_deletions.id,
          lastError: core_users_deletions.lastError,
          scheduledAt: core_users_deletions.scheduledAt,
          status: core_users_deletions.status,
          userId: core_users.id,
          userName: core_users.name,
        })
        .from(core_users_deletions)
        .leftJoin(core_users, eq(core_users.id, core_users_deletions.userId))
        .where(and(open, lt(core_users_deletions.scheduledAt, now)))
        .orderBy(asc(core_users_deletions.scheduledAt))
        .limit(ATTENTION_LIMIT),
      db
        .select({ lastRun: core_cron.lastRun })
        .from(core_cron)
        .where(
          and(
            eq(core_cron.pluginId, manifest.id),
            eq(core_cron.name, accountDeletionCron.name),
          ),
        )
        .limit(1),
    ]);

    const lastRun = job?.lastRun ?? null;

    return c.json(
      {
        attention: attention
          .filter(row => row.status === "pending" || row.status === "failed")
          .map(row => ({
            attempts: row.attempts,
            id: row.id,
            lastError: row.lastError,
            scheduledAt: row.scheduledAt,
            status:
              row.status === "failed"
                ? ("failed" as const)
                : ("pending" as const),
            user:
              row.userId !== null && row.userName !== null
                ? { id: row.userId, name: row.userName }
                : null,
          }))
          .sort(
            (a, b) =>
              Number(b.status === "failed") - Number(a.status === "failed"),
          ),
        deadlineDays: ACCOUNT_DELETION_DEADLINE_DAYS,
        erasedLast30Days: erased?.total ?? 0,
        failed: byStatus.find(row => row.status === "failed")?.total ?? 0,
        job: {
          lastRun,
          nextRun: getNextCronRunDate(accountDeletionCron.schedule, lastRun),
        },
        nextScheduledAt: next?.at ?? null,
        oldestOpenAt: oldest?.at ?? null,
        overdue: overdueCount?.total ?? 0,
        pending: byStatus.find(row => row.status === "pending")?.total ?? 0,
      },
      200,
    );
  },
});
