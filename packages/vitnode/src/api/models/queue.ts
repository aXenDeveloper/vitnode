import type { Context } from "hono";

import { core_queue } from "@/database/queue";

export interface QueueDispatchArgs {
  availableAt?: Date;
  maxAttempts?: number;
  name: string;
  payload?: Record<string, unknown>;
  /**
   * Who owns the handler, when that is not the plugin handling the request.
   *
   * The worker resolves a handler by `` `${pluginId}:${name}` ``, so a task
   * registered by core but dispatched from a plugin's route needs to say so -
   * otherwise the row is stamped with the plugin's id and nothing will ever
   * claim it. Defaults to the requesting plugin, which is right for the
   * ordinary case where a plugin dispatches its own task.
   */
  pluginId?: string;
  priority?: number;
  queue?: string;
  /**
   * Join an existing transaction instead of using the request handle.
   *
   * Needed whenever the row that the task refers to is written in the same
   * unit of work: without it, the queue row can commit while the row it points
   * at rolls back, and the task wakes up to find nothing there.
   */
  tx?: Omit<Context["var"]["db"], "$client">;
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
    pluginId: explicitPluginId,
    queue = "default",
    priority = 0,
    maxAttempts,
    availableAt,
    tx,
  }: QueueDispatchArgs): Promise<{ id: number }> {
    const pluginId =
      explicitPluginId ?? this.c.get("plugin")?.id ?? "@vitnode/core";

    const registeredTask = this.c
      .get("core")
      .queue.find(task => task.pluginId === pluginId && task.name === name);

    const [row] = await (tx ?? this.c.get("db"))
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
