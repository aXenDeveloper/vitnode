import type { drizzle } from "drizzle-orm/postgres-js";

import { core_cron } from "@/database/cron";
import { type CronHealth, getCronHealth } from "@/lib/api/cron-health";

export const loadCronHealth = async (
  db: ReturnType<typeof drizzle>,
): Promise<CronHealth> =>
  getCronHealth(
    await db
      .select({
        createdAt: core_cron.createdAt,
        lastRun: core_cron.lastRun,
        schedule: core_cron.schedule,
      })
      .from(core_cron),
  );
