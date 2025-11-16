import { eq } from "drizzle-orm";
import { z } from "zod";

import type { CronJobConfig } from "@/api/lib/cron";

import { buildRoute } from "@/api/lib/route";
import { core_cron } from "@/database/cron";
import { getNextCronRunDate } from "@/lib/api/get-next-cron-run-date";

export const runCronRoute = buildRoute({
  route: {
    method: "post",
    description: "Run a specific cron job",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({
              message: z.string().optional(),
              error: z.string().optional(),
            }),
          },
        },
        description: "Cron job executed successfully",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({
              message: z.string().optional(),
              error: z.string().optional(),
            }),
          },
        },
        description: "Cron job not found",
      },
      500: {
        content: {
          "application/json": {
            schema: z.object({
              message: z.string().optional(),
              error: z.string().optional(),
            }),
          },
        },
        description: "Internal server error",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const cronJobs: CronJobConfig[] = c.get("core").cron;
    const param = c.req.valid("param");

    try {
      const cronFromDb = await db
        .select()
        .from(core_cron)
        .where(eq(core_cron.id, +param.id))
        .limit(1);

      if (cronFromDb.length === 0) {
        return c.json({ error: "Cron job not found" }, 404);
      }

      const dbCron = cronFromDb[0];

      const job: CronJobConfig | undefined = cronJobs.find(
        j =>
          j.name === dbCron.name &&
          j.pluginId === dbCron.pluginId &&
          j.module === dbCron.module,
      );

      if (!job) {
        return c.json({ error: "Cron job configuration not found" }, 404);
      }

      const now = new Date();

      try {
        await job.handler(c);

        await db
          .update(core_cron)
          .set({
            lastRun: now,
            nextRun: getNextCronRunDate(job.schedule, now),
          })
          .where(eq(core_cron.id, dbCron.id));

        return c.json(
          {
            message: "Cron job executed successfully",
          },
          201,
        );
      } catch (error) {
        await c.get("log").error(`Error executing cron job: ${error}`);

        return c.json({ error: "Failed to execute cron job" }, 500);
      }
    } catch (error) {
      await c.get("log").error(`Error running cron job: ${error}`);

      return c.json({ error: "Internal server error" }, 500);
    }
  },
});
