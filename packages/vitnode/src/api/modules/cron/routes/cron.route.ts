import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { cronAuthMiddleware } from "@/api/middlewares/cron-auth.middleware";
import { core_cron } from "@/database/cron";
import { getNextCronRunDate } from "@/lib/api/get-next-cron-run-date";

import {
  cleanupOutdatedCronJobs,
  processCronJobs,
  updateCronJobs,
} from "../helpers/process-cron-jobs";

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

          await db.insert(core_cron).values(newJobsValues);
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
        // Optimize: Create a Map for O(1) lookup instead of O(n) find operations
        const cronFromDbMap = new Map(
          cronFromDb.map(dbJob => [
            `${dbJob.pluginId}:${dbJob.module}:${dbJob.name}`,
            dbJob,
          ]),
        );

        const executionPromises = jobsToExecute.map(async job => {
          try {
            await job.handler(c);

            const jobKey = `${job.pluginId}:${job.module}:${job.name}`;
            const dbJob = cronFromDbMap.get(jobKey);

            if (dbJob) {
              await db
                .update(core_cron)
                .set({
                  lastRun: now,
                  nextRun: getNextCronRunDate(job.schedule, now),
                })
                .where(eq(core_cron.id, dbJob.id));
            }

            return { success: true, jobName: job.name };
          } catch (error) {
            await c
              .get("log")
              .error(
                `Error executing cron job "${job.pluginId}:${job.module}:${job.name}": ${error}`,
              );

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
