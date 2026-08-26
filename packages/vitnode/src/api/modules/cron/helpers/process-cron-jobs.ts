import type { drizzle } from "drizzle-orm/postgres-js";

import { eq, inArray } from "drizzle-orm";

import type { CronJobConfig } from "@/api/lib/cron";

import { core_cron } from "@/database/cron";
import { shouldCronJobRun } from "@/lib/api/should-cron-job-run";
import { validateCronSchedule } from "@/lib/api/validate-cron-schedule";

interface CronJobFromDb {
  createdAt: Date;
  description: null | string;
  id: number;
  lastRun: Date | null;
  module: string;
  name: string;
  nextRun: Date | null;
  pluginId: string;
  schedule: string;
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
  db: ReturnType<typeof drizzle>,
  cronFromDb: CronJobFromDb[],
  currentCronJobs: CronJobConfig[],
) {
  if (cronFromDb.length === 0) return;

  const currentCronIdentifiers = new Set(
    currentCronJobs.map(job => `${job.pluginId}:${job.module}:${job.name}`),
  );

  const cronJobsToDelete = cronFromDb
    .filter(
      dbCron =>
        !currentCronIdentifiers.has(
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
    changes: { description?: boolean; schedule?: boolean };
    existingJob: CronJobFromDb;
    job: CronJobConfig;
  }[] = [];

  const cronFromDbMap = new Map(
    cronFromDb.map(dbJob => [
      `${dbJob.pluginId}:${dbJob.module}:${dbJob.name}`,
      dbJob,
    ]),
  );

  for (const job of cronJobs) {
    if (!validateCronSchedule(job.schedule)) {
      // eslint-disable-next-line no-console
      console.warn(
        `\x1b[34m[VitNode]\x1b[0m \x1b[33mInvalid cron schedule for job "${job.pluginId}:${job.module}:${job.name}"\x1b[0m: ${job.schedule}`,
      );
      continue;
    }

    const jobKey = `${job.pluginId}:${job.module}:${job.name}`;
    const existingJob = cronFromDbMap.get(jobKey);

    if (existingJob) {
      const changes = getJobChanges(job, existingJob);
      if (Object.keys(changes).length > 0) {
        jobsToUpdate.push({ job, existingJob, changes });
      }
    } else {
      newJobs.push(job);
    }

    if (shouldCronJobRun(job.schedule, existingJob?.lastRun ?? null)) {
      jobsToExecute.push(job);
    }
  }

  return { newJobs, jobsToExecute, jobsToUpdate };
}

export async function updateCronJobs(
  db: ReturnType<typeof drizzle>,
  jobsToUpdate: {
    changes: { description?: boolean; schedule?: boolean };
    existingJob: CronJobFromDb;
    job: CronJobConfig;
  }[],
) {
  if (jobsToUpdate.length === 0) return;

  const updatePromises = jobsToUpdate.map(({ job, existingJob, changes }) => {
    const updateData: Partial<{
      description: null | string;
      schedule: string;
    }> = {};

    if (changes.description) {
      updateData.description = job.description ?? null;
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
