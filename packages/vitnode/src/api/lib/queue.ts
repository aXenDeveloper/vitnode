import type { Context } from "hono";

import type { EnvVitNode } from "../middlewares/global.middleware";

export interface BuildQueueTaskReturn {
  description?: string;
  handler: (
    c: Context<EnvVitNode>,
    payload: Record<string, unknown>,
  ) => Promise<void> | void;
  /**
   * How long one run may take before the task counts as abandoned and is
   * picked up again (the attempt is spent). Default 10 minutes.
   */
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

/**
 * Thrown by a task that cannot run *yet* - a budget is used up, a resource
 * is busy. The task goes back to pending until `until`, and the attempt is
 * not counted: waiting is not failing.
 */
export class QueueDeferError extends Error {
  constructor(until: Date, reason: string) {
    super(reason);
    this.name = "QueueDeferError";
    this.until = until;
  }

  readonly until: Date;
}
