import type { drizzle } from "drizzle-orm/postgres-js";

import type { CronJobConfig } from "@/api/lib/cron";

import { core_cron } from "@/database/cron";

import {
  cleanupOutdatedCronJobs,
  processCronJobs,
  updateCronJobs,
} from "./process-cron-jobs";

export async function registerCronJobs(
  db: ReturnType<typeof drizzle>,
  cronJobs: CronJobConfig[],
) {
  const cronFromDb = await db.select().from(core_cron);
  await cleanupOutdatedCronJobs(db, cronFromDb, cronJobs);

  const { newJobs, jobsToUpdate } = processCronJobs(cronJobs, cronFromDb);

  if (newJobs.length > 0) {
    await db.insert(core_cron).values(
      newJobs.map(job => ({
        name: job.name,
        description: job.description ?? null,
        lastRun: null,
        nextRun: null,
        pluginId: job.pluginId,
        module: job.module,
        schedule: job.schedule,
      })),
    );
  }

  await updateCronJobs(db, jobsToUpdate);
}
