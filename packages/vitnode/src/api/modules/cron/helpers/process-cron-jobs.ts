import { eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { validate } from "node-cron";
import type { CronJobConfig } from "@/api/lib/cron";
import { core_cron } from "@/database/cron";
import { shouldCronJobRun } from "@/lib/api/should-cron-job-run";

interface CronJobFromDb {
  id: number;
  name: string;
  description: string | null;
  lastRun: Date | null;
  nextRun: Date | null;
  createdAt: Date;
  pluginId: string;
  module: string;
  schedule: string;
}

function findExistingJob(
  job: CronJobConfig,
  cronFromDb: CronJobFromDb[],
): CronJobFromDb | undefined {
  return cronFromDb.find(
    dbJob =>
      dbJob.name === job.name &&
      dbJob.pluginId === job.pluginId &&
      dbJob.module === job.module,
  );
}

function getJobChanges(
  job: CronJobConfig,
  existingJob: CronJobFromDb,
): { description?: boolean; schedule?: boolean } {
  const changes: { description?: boolean; schedule?: boolean } = {};
  if (existingJob.description !== job.description) {
    changes.description = true;
  }
  if (existingJob.schedule !== job.schedule) {
    changes.schedule = true;
  }
  return changes;
}

export async function cleanupOutdatedCronJobs(
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

export function processCronJobs(
  cronJobs: CronJobConfig[],
  cronFromDb: CronJobFromDb[],
) {
  const newJobs: CronJobConfig[] = [];
  const jobsToExecute: CronJobConfig[] = [];
  const jobsToUpdate: {
    job: CronJobConfig;
    existingJob: CronJobFromDb;
    changes: { description?: boolean; schedule?: boolean };
  }[] = [];

  for (const job of cronJobs) {
    if (!validate(job.schedule)) {
      // biome-ignore lint/suspicious/noConsole: needed for cron job monitoring
      console.warn(
        `\x1b[34m[VitNode]\x1b[0m \x1b[33mInvalid cron schedule for job "${job.pluginId}:${job.module}:${job.name}"\x1b[0m: ${job.schedule}`,
      );
      continue;
    }

    const existingJob = findExistingJob(job, cronFromDb);

    if (existingJob) {
      const changes = getJobChanges(job, existingJob);
      if (Object.keys(changes).length > 0) {
        jobsToUpdate.push({ job, existingJob, changes });
      }
    } else {
      newJobs.push(job);
    }

    if (shouldCronJobRun(job.schedule, existingJob?.lastRun || null)) {
      jobsToExecute.push(job);
    }
  }

  return { newJobs, jobsToExecute, jobsToUpdate };
}

export async function updateCronJobs(
  db: PostgresJsDatabase<Record<string, never>>,
  jobsToUpdate: {
    job: CronJobConfig;
    existingJob: CronJobFromDb;
    changes: { description?: boolean; schedule?: boolean };
  }[],
) {
  if (jobsToUpdate.length === 0) return;

  const updatePromises = jobsToUpdate.map(({ job, existingJob, changes }) => {
    const updateData: Partial<{
      description: string | null;
      schedule: string;
    }> = {};

    if (changes.description) {
      updateData.description = job.description || null;
    }

    if (changes.schedule) {
      updateData.schedule = job.schedule;
    }

    return db
      .update(core_cron)
      .set(updateData)
      .where(eq(core_cron.id, existingJob.id));
  });

  await Promise.all(updatePromises);
}
