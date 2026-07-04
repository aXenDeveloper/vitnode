import type { Context } from "hono";

import type { EnvVitNode } from "../middlewares/global.middleware";

export interface BuildQueueTaskReturn {
  description?: string;
  handler: (
    c: Context<EnvVitNode>,
    payload: Record<string, unknown>,
  ) => Promise<void> | void;
  maxAttempts?: number;
  name: string;
}

export interface QueueTaskConfig extends BuildQueueTaskReturn {
  module: string;
  pluginId: string;
}

export function buildQueueTask({
  name,
  handler,
  description,
  maxAttempts,
}: BuildQueueTaskReturn): BuildQueueTaskReturn {
  return { name, handler, description, maxAttempts };
}
