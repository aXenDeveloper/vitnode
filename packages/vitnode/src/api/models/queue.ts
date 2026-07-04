import type { Context } from "hono";

import { core_queue } from "@/database/queue";

export interface QueueDispatchArgs {
  availableAt?: Date;
  maxAttempts?: number;
  name: string;
  payload?: Record<string, unknown>;
  priority?: number;
  queue?: string;
}

/**
 * Enqueue background work into the database-backed task queue, exposed on the
 * request context as `c.get("queue")`. Rows are drained by the `process-queue`
 * cron job. The task `name` must match a handler registered via
 * {@link buildQueueTask} in a module's `queueTasks`.
 */
export class QueueModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  async dispatch({
    name,
    payload = {},
    queue = "default",
    priority = 0,
    maxAttempts,
    availableAt,
  }: QueueDispatchArgs): Promise<{ id: number }> {
    const pluginId = this.c.get("plugin")?.id ?? "@vitnode/core";

    const registeredTask = this.c
      .get("core")
      .queue.find(task => task.pluginId === pluginId && task.name === name);

    const [row] = await this.c
      .get("db")
      .insert(core_queue)
      .values({
        pluginId,
        name,
        queue,
        payload,
        priority,
        maxAttempts: maxAttempts ?? registeredTask?.maxAttempts ?? 3,
        availableAt: availableAt ?? new Date(),
      })
      .returning({ id: core_queue.id });

    return row;
  }
}
