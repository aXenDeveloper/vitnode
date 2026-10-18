import type { Context } from "hono";

import type { EnvVitNode } from "../middlewares/global.middleware";

/** A background task handler, as returned by {@link buildQueueTask}. */
export interface BuildQueueTaskReturn {
  /** A note on what the task does. Kept on the definition only; core does not display it. */
  description?: string;
  /**
   * Runs once per claimed task with the payload given to `dispatch()`. The
   * payload is stored as JSON, so validate it before use.
   *
   * Returning completes the task. Throwing retries it with exponential backoff
   * (10 s, doubling, capped at 1 hour) until `maxAttempts` is reached, then
   * marks it failed. Throw {@link QueueDeferError} to postpone without using
   * up an attempt.
   */
  handler: (
    c: Context<EnvVitNode>,
    payload: Record<string, unknown>,
  ) => Promise<void> | void;
  /**
   * Seconds a worker may hold a claimed task before it is treated as
   * abandoned and returned to the queue (or failed, once out of attempts).
   * Defaults to 600. Raise it for tasks that legitimately run longer.
   */
  leaseSeconds?: number;
  /**
   * Default attempt limit for tasks dispatched without their own
   * `maxAttempts`. Defaults to 3.
   */
  maxAttempts?: number;
  /**
   * Unique within the plugin - tasks are matched to handlers by plugin id and
   * `name`, not by module.
   */
  name: string;
}

/** A queue task after registration, tagged with the module and plugin that declared it. */
export interface QueueTaskConfig extends BuildQueueTaskReturn {
  module: string;
  pluginId: string;
}

/**
 * Declares a handler for durable background work stored in the `core_queue`
 * table. Add it to a top-level module's `queueTasks` array, then enqueue work
 * with `c.get("queue").dispatch({ name, payload })`.
 *
 * Tasks are processed by the core `process-queue` cron job (every minute, up
 * to 25 per tick, highest `priority` first), so a cron adapter or an external
 * cron trigger must be running.
 *
 * @example
 * ```ts
 * import { buildQueueTask } from "@vitnode/core/api/lib/queue";
 *
 * export const reindexPostTask = buildQueueTask({
 *   name: "reindex-post",
 *   maxAttempts: 5,
 *   handler: async (c, payload) => {
 *     const postId = Number(payload.postId);
 *     // ...
 *   },
 * });
 *
 * // In a route: await c.get("queue").dispatch({ name: "reindex-post", payload: { postId } });
 * ```
 */
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
 * Throw from a queue task handler to put the task back to `pending` until
 * `until`, without counting the current attempt - for example while waiting
 * on a rate limit or an external resource.
 */
export class QueueDeferError extends Error {
  constructor(until: Date, reason: string) {
    super(reason);
    this.name = "QueueDeferError";
    this.until = until;
  }

  readonly until: Date;
}
