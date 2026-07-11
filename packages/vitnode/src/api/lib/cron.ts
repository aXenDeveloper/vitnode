import type { Context } from "hono";

import { CONFIG } from "@/lib/config";

import type { EnvVitNode } from "../middlewares/global.middleware";
import type { BuildPluginApiReturn } from "./plugin";

export interface CronAdapter {
  schedule: () => void;
}

export interface BuildCronReturn {
  description?: string;
  handler: (c: Context<EnvVitNode>) => Promise<void> | void;
  name: string;
  schedule: string;
}

export interface CronJobConfig extends BuildCronReturn {
  module: string;
  pluginId: string;
}

export function buildCron({
  name,
  schedule,
  handler,
  description,
}: BuildCronReturn): BuildCronReturn {
  return { name, schedule, handler, description };
}

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

export const handleCronJobs = async () => {
  const url = new URL("/api/@vitnode/core/cron", CONFIG.api.origin);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (CONFIG.cronJobSecret) {
    headers.authorization = `Bearer ${CONFIG.cronJobSecret}`;
  }

  await fetch(url.toString(), {
    method: "POST",
    headers,
  });
};
