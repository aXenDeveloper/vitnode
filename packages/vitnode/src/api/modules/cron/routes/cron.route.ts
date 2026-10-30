import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { AUDIT_SYSTEM_ACTOR, withAuditContext } from "@/api/lib/audit/context";
import { cronAuthMiddleware } from "@/api/middlewares/cron-auth.middleware";
import { core_cron } from "@/database/cron";
import { getNextCronRunDate } from "@/lib/api/get-next-cron-run-date";

import {
  cleanupOutdatedCronJobs,
  processCronJobs,
  updateCronJobs,
} from "../helpers/process-cron-jobs";

const sameMillisecond = (lastRun: Date) =>
  and(
    gte(core_cron.lastRun, lastRun),
    lt(core_cron.lastRun, new Date(lastRun.getTime() + 1)),
  );

export const runCronRoute = buildRoute({
  route: {
    method: "post",
    description: "Run cron job",
    path: "/",
    middleware: [cronAuthMiddleware()],
    responses: {
      200: {
        content: {
          "text/plain": {
            schema: z.string(),
          },
        },
        description: "Cron started successfully",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const cronJobs = c.get("core").cron;

    try {
      const cronFromDb = await db.select().from(core_cron);
      await cleanupOutdatedCronJobs(db, cronFromDb, cronJobs);

      const now = new Date();
      let executedJobs = 0;

      const { newJobs, jobsToExecute, jobsToUpdate } = processCronJobs(
        cronJobs,
        cronFromDb,
      );

      const cronFromDbMap = new Map(
        cronFromDb.map(dbJob => [
          `${dbJob.pluginId}:${dbJob.module}:${dbJob.name}`,
          dbJob,
        ]),
      );

      if (newJobs.length > 0) {
        try {
          const newJobsValues = newJobs.map(job => ({
            name: job.name,
            description: job.description ?? null,
            lastRun: null,
            nextRun: null,
            pluginId: job.pluginId,
            module: job.module,
            schedule: job.schedule,
          }));

          const inserted = await db
            .insert(core_cron)
            .values(newJobsValues)
            .returning();
          for (const dbJob of inserted) {
            cronFromDbMap.set(
              `${dbJob.pluginId}:${dbJob.module}:${dbJob.name}`,
              dbJob,
            );
          }
        } catch (error) {
          await c.get("log").error(`Error inserting new cron jobs: ${error}`);
        }
      }

      try {
        await updateCronJobs(db, jobsToUpdate);
      } catch (error) {
        await c.get("log").error(`Error updating cron jobs: ${error}`);
      }

      if (jobsToExecute.length > 0) {
        const executionPromises = jobsToExecute.map(async job => {
          const dbJob = cronFromDbMap.get(
            `${job.pluginId}:${job.module}:${job.name}`,
          );

          // Every instance's ticker hits this route each minute. Claim the run
          // first (compare-and-set on the `lastRun` we read) so exactly one
          // instance executes a due job; the others see 0 rows and skip it.
          if (dbJob) {
            const [claimed] = await db
              .update(core_cron)
              .set({
                lastRun: now,
                nextRun: getNextCronRunDate(job.schedule, now),
              })
              .where(
                and(
                  eq(core_cron.id, dbJob.id),
                  dbJob.lastRun
                    ? sameMillisecond(dbJob.lastRun)
                    : isNull(core_cron.lastRun),
                ),
              )
              .returning({ id: core_cron.id });
            if (!claimed) return { success: false, jobName: job.name };
          }

          try {
            await withAuditContext(
              c,
              {
                actor: AUDIT_SYSTEM_ACTOR,
                area: "system",
                metadata: { cronJob: job.name, trigger: "cron" },
              },
              async () => {
                await job.handler(c);
              },
            );

            return { success: true, jobName: job.name };
          } catch (error) {
            await c
              .get("log")
              .error(
                `Error executing cron job "${job.pluginId}:${job.module}:${job.name}": ${error}`,
              );

            // Hand the claim back so a failed job is retried on the next tick.
            if (dbJob) {
              await db
                .update(core_cron)
                .set({ lastRun: dbJob.lastRun, nextRun: dbJob.nextRun })
                .where(
                  and(eq(core_cron.id, dbJob.id), eq(core_cron.lastRun, now)),
                )
                .catch(() => undefined);
            }

            return { success: false, jobName: job.name, error };
          }
        });

        const results = await Promise.allSettled(executionPromises);
        executedJobs = results.filter(
          result => result.status === "fulfilled" && result.value.success,
        ).length;
      }

      return c.text(`Cron jobs processed. Executed ${executedJobs} jobs.`, 200);
    } catch (error) {
      await c.get("log").error(`Error processing cron jobs: ${error}`);

      return c.text("Error processing cron jobs", 500);
    }
  },
});
