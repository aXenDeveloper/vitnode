import type { Context } from "hono";

import { CONFIG } from "@/lib/config";

import type { EnvVitNode } from "../middlewares/global.middleware";
import type { BuildPluginApiReturn } from "./plugin";

/**
 * Drives the cron runner in a long-running API process - set it as `cron` in
 * the API config. `schedule()` is called once at boot and should call
 * {@link handleCronJobs} on a timer (`@vitnode/node-cron` does it every
 * minute). Without an adapter, something external has to `POST` the
 * `/api/@vitnode/core/cron` endpoint instead.
 */
export interface CronAdapter {
  schedule: () => void;
}

/** A cron job, as returned by {@link buildCron}. */
export interface BuildCronReturn {
  /** Shown to admins in the cron job list. */
  description?: string;
  /**
   * The job's work, run server-side with a request context. A throw is logged,
   * and the job's `lastRun` is left unchanged, so it is due again on the next
   * tick.
   */
  handler: (c: Context<EnvVitNode>) => Promise<void> | void;
  /**
   * Unique within the module. Together with the plugin id and module name it
   * identifies the job's database row, so renaming a job creates a new row.
   */
  name: string;
  /**
   * A cron expression with 5 fields (`minute hour day month weekday`) or 6
   * (`second` first). An invalid expression is warned about and the job is
   * skipped. The runner is only as precise as its tick - every minute with
   * `@vitnode/node-cron`.
   */
  schedule: string;
}

/** A cron job after registration, tagged with the module and plugin that declared it. */
export interface CronJobConfig extends BuildCronReturn {
  module: string;
  pluginId: string;
}

/**
 * Declares a recurring server-side job. Add it to a top-level module's
 * `cronJobs` array (`buildModule({ cronJobs })`).
 *
 * On each tick the runner executes every job whose `schedule` has come due
 * since its last successful run; due jobs run concurrently. For heavy or
 * retryable work, have the job dispatch queue tasks instead of doing the work
 * itself. A job runs inside core's cron request, so `c.get("plugin")` is
 * `@vitnode/core`: pass your plugin's id to `dispatch` explicitly.
 *
 * @example
 * ```ts
 * import { buildCron } from "@vitnode/core/api/lib/cron";
 *
 * export const cleanDraftsCron = buildCron({
 *   name: "clean-drafts",
 *   description: "Delete abandoned drafts",
 *   schedule: "0 3 * * *",
 *   handler: async c => {
 *     await c
 *       .get("queue")
 *       .dispatch({ name: "clean-drafts", pluginId: "@acme/blog" });
 *   },
 * });
 * ```
 */
export function buildCron({
  name,
  schedule,
  handler,
  description,
}: BuildCronReturn): BuildCronReturn {
  return { name, schedule, handler, description };
}

/** Flattens every plugin's cron jobs, tagging each with its plugin id. */
export function collectCronJobs(
  plugins: BuildPluginApiReturn[],
): CronJobConfig[] {
  return plugins.flatMap(plugin =>
    (plugin.cronJobs ?? []).map(cronJob => ({
      pluginId: plugin.pluginId,
      module: cronJob.module,
      name: cronJob.name,
      schedule: cronJob.schedule,
      handler: cronJob.handler,
      description: cronJob.description,
    })),
  );
}

const reportFailedCronTick = (reason: string) => {
  // oxlint-disable-next-line no-console
  console.error(
    `\x1b[34m[VitNode]\x1b[0m \x1b[31mCron tick failed\x1b[0m: ${reason}`,
  );
};

/**
 * One cron tick: `POST`s the API's own `/api/@vitnode/core/cron` endpoint,
 * authenticated with the `CRON_SECRET` environment variable (which falls back
 * to a development-only default that production refuses). Call it from a
 * {@link CronAdapter}'s timer.
 *
 * Never throws once the API URL is valid - a failed request or non-2xx
 * response is written to `console.error`.
 */
export const handleCronJobs = async () => {
  const url = new URL("/api/@vitnode/core/cron", CONFIG.api.origin);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (CONFIG.cronJobSecret) {
    headers.authorization = `Bearer ${CONFIG.cronJobSecret}`;
  }

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      reportFailedCronTick(`${response.status} ${await response.text()}`);
    }
  } catch (error) {
    reportFailedCronTick(
      error instanceof Error ? error.message : String(error),
    );
  }
};
