import type { Context } from "hono";

import { core_queue } from "@/database/queue";

/** What to enqueue with `c.get("queue").dispatch()`. */
export interface QueueDispatchArgs {
  /** Earliest time the task may run. Defaults to now. */
  availableAt?: Date;
  /**
   * While a task with the same plugin id and `dedupeKey` is pending or
   * processing, a new dispatch is dropped and reported as `deduplicated`.
   */
  dedupeKey?: string;
  /** Overrides the handler's `maxAttempts`; falls back to 3. */
  maxAttempts?: number;
  /** The `name` of a task registered with `buildQueueTask`. */
  name: string;
  /** JSON-serializable data passed to the handler. Defaults to `{}`. */
  payload?: Record<string, unknown>;

  /**
   * Plugin that owns the handler. Defaults to the plugin of the current
   * request's route, then `@vitnode/core`.
   */
  pluginId?: string;
  /** Higher runs first. Defaults to 0. */
  priority?: number;
  /**
   * Queue name. Defaults to `"default"`. The default worker drains every queue
   * except `ai`, which core's AI cron drains on its own.
   */
  queue?: string;

  /**
   * A transaction to insert with, so the task is only enqueued if the
   * surrounding write commits.
   */
  tx?: Omit<Context["var"]["db"], "$client">;
}

/** Server-side queue API, available as `c.get("queue")` in API handlers. */
export class QueueModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  /**
   * Enqueues a task. Does not run it - the queue worker picks it up on a
   * later tick.
   *
   * @returns The new row's id, or `{ deduplicated: true, id: null }` when an
   * active task with the same `dedupeKey` already exists.
   */
  async dispatch({
    dedupeKey,
    name,
    payload = {},
    pluginId: explicitPluginId,
    queue = "default",
    priority = 0,
    maxAttempts,
    availableAt,
    tx,
  }: QueueDispatchArgs): Promise<{ deduplicated: boolean; id: null | number }> {
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
        dedupeKey: dedupeKey ?? null,
        maxAttempts: maxAttempts ?? registeredTask?.maxAttempts ?? 3,
        availableAt: availableAt ?? new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: core_queue.id });

    return row
      ? { deduplicated: false, id: row.id }
      : { deduplicated: true, id: null };
  }
}
