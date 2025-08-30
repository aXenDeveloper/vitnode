import type { Context } from "hono";
import type { EnvVitNode } from "../middlewares/global.middleware";

export interface CronAdapter {
  schedule(cronSecret?: string): void;
}

export interface BuildCronReturn {
  name: string;
  schedule: string;
  description?: string;
  handler: (c: Context<EnvVitNode>) => void | Promise<void>;
}

export function buildCron({
  name,
  schedule,
  handler,
  description,
}: BuildCronReturn): BuildCronReturn {
  return { name, schedule, handler, description };
}
