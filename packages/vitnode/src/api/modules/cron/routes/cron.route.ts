import { eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { validate } from "node-cron";
import { z } from "zod";
import type { CronJobConfig } from "@/api/lib/cron";
import { buildRoute } from "@/api/lib/route";
import { cronAuthMiddleware } from "@/api/middlewares/cron-auth.middleware";
import { CONFIG_PLUGIN } from "@/config";
import { core_cron } from "@/database/cron";
import { shouldCronJobRun } from "@/lib/api/should-cron-job-run";

interface CronJobFromDb {
  id: number;
  name: string;
  description: string | null;
  lastRun: Date | null;
  createdAt: Date;
  pluginId: string;
  module: string;
}

async function cleanupOutdatedCronJobs(
  db: PostgresJsDatabase<Record<string, never>>,
  cronFromDb: CronJobFromDb[],
  currentCronJobs: CronJobConfig[],
) {
  if (cronFromDb.length === 0) return;

  const currentCronIdentifiers = currentCronJobs.map(
    job => `${job.pluginId}:${job.module}:${job.name}`,
  );

  const cronJobsToDelete = cronFromDb
    .filter(
      dbCron =>
        !currentCronIdentifiers.includes(
          `${dbCron.pluginId}:${dbCron.module}:${dbCron.name}`,
        ),
    )
    .map(dbCron => dbCron.id);

  if (cronJobsToDelete.length > 0) {
    await db.delete(core_cron).where(inArray(core_cron.id, cronJobsToDelete));
  }
}

function processCronJobs(
  cronJobs: CronJobConfig[],
  cronFromDb: CronJobFromDb[],
) {
  const newJobs: CronJobConfig[] = [];
  const jobsToExecute: CronJobConfig[] = [];
  const jobsToUpdate: { job: CronJobConfig; existingJob: CronJobFromDb }[] = [];

  for (const job of cronJobs) {
    if (!validate(job.schedule)) {
      // biome-ignore lint/suspicious/noConsole: needed for cron job monitoring
      console.warn(
        `\x1b[34m[VitNode]\x1b[0m \x1b[33mInvalid cron schedule for job "${job.pluginId}:${job.module}:${job.name}"\x1b[0m: ${job.schedule}`,
      );
      continue;
    }

    const existingJob = cronFromDb.find(
      dbJob =>
        dbJob.name === job.name &&
        dbJob.pluginId === job.pluginId &&
        dbJob.module === job.module,
    );

    if (existingJob) {
      if (existingJob.description !== job.description) {
        jobsToUpdate.push({ job, existingJob });
      }
    } else {
      newJobs.push(job);
    }

    const shouldRun = shouldCronJobRun(
      job.schedule,
      existingJob?.lastRun || null,
    );

    if (shouldRun) {
      jobsToExecute.push(job);
    }
  }

  return { newJobs, jobsToExecute, jobsToUpdate };
}

async function updateCronJobDescriptions(
  db: PostgresJsDatabase<Record<string, never>>,
  jobsToUpdate: { job: CronJobConfig; existingJob: CronJobFromDb }[],
) {
  if (jobsToUpdate.length === 0) return;

  const updatePromises = jobsToUpdate.map(({ job, existingJob }) =>
    db
      .update(core_cron)
      .set({ description: job.description || null })
      .where(eq(core_cron.id, existingJob.id)),
  );

  await Promise.all(updatePromises);
}

export const runCronRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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
            description: job.description || null,
            lastRun: null,
            pluginId: job.pluginId,
            module: job.module,
          }));

          await db.insert(core_cron).values(newJobsValues);
        } catch (error) {
          await c.get("log").error(`Error inserting new cron jobs: ${error}`);
        }
      }

      try {
        await updateCronJobDescriptions(db, jobsToUpdate);
      } catch (error) {
        await c
          .get("log")
          .error(`Error updating cron job descriptions: ${error}`);
      }

      if (jobsToExecute.length > 0) {
        const executionPromises = jobsToExecute.map(async job => {
          try {
            await job.handler(c);

            const dbJob = cronFromDb.find(
              dbJob =>
                dbJob.name === job.name &&
                dbJob.pluginId === job.pluginId &&
                dbJob.module === job.module,
            );

            if (dbJob) {
              await db
                .update(core_cron)
                .set({ lastRun: now })
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
