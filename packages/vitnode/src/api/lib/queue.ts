import type { Context } from "hono";

import type { EnvVitNode } from "../middlewares/global.middleware";

export interface BuildQueueTaskReturn {
  description?: string;
  handler: (
    c: Context<EnvVitNode>,
    payload: Record<string, unknown>,
  ) => Promise<void> | void;
  leaseSeconds?: number;
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
  leaseSeconds,
  maxAttempts,
}: BuildQueueTaskReturn): BuildQueueTaskReturn {
  return { name, handler, description, leaseSeconds, maxAttempts };
}

export class QueueDeferError extends Error {
  constructor(until: Date, reason: string) {
    super(reason);
    this.name = "QueueDeferError";
    this.until = until;
  }

  readonly until: Date;
}
