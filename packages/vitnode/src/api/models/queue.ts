import type { Context } from "hono";
import type { z } from "zod";

import type { QueueTaskDefinition } from "@/api/lib/queue";

import { parseJsonWire } from "@/api/lib/json-wire";
import {
  QueuePayloadValidationError,
  QueueTaskRegistrationError,
} from "@/api/lib/queue";
import { core_queue } from "@/database/queue";

/** The options of `c.get("queue").dispatch(task, payload, options)`. */
export interface QueueDispatchOptions {
  /** Earliest time the task may run. Defaults to now. */
  availableAt?: Date;
  /**
   * While a task with the same plugin id and `dedupeKey` is pending or
   * processing, a new dispatch is dropped and reported as `deduplicated`.
   */
  dedupeKey?: string;
  /** Overrides the task's `maxAttempts`; falls back to 3. */
  maxAttempts?: number;
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

export interface QueueDispatchResult {
  /** `true` when an active task with the same `dedupeKey` already exists. */
  deduplicated: boolean;
  /** The new row's id, or `null` when deduplicated. */
  id: null | number;
}

/** Server-side queue API, available as `c.get("queue")` in API handlers. */
export class QueueModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  /**
   * Enqueues a task under the plugin that defines it. The payload is
   * type-checked against the task's schema input, copied to JSON and
   * validated before the row is inserted; the JSON (not the schema's output)
   * is stored, and parsed again just before the handler runs. Does not run
   * the task - the queue worker picks it up on a later tick.
   *
   * @returns The new row's id, or `{ deduplicated: true, id: null }` when an
   * active task with the same `dedupeKey` already exists.
   * @throws {QueuePayloadValidationError} When the payload is not JSON or the
   * schema rejects it. Nothing is enqueued.
   * @throws {QueueTaskRegistrationError} When the task is not registered in a
   * top-level module's `queueTasks` of its plugin, or another task is
   * registered under its name.
   *
   * @example
   * ```ts
   * import { reindexPostTask } from "@/api/modules/posts/tasks/reindex-post.task";
   *
   * await c.get("queue").dispatch(
   *   reindexPostTask,
   *   { postId: 42 },
   *   { dedupeKey: "reindex-post:42", priority: 10 },
   * );
   * ```
   */
  async dispatch<Schema extends z.ZodType>(
    task: QueueTaskDefinition<string, string, Schema>,
    payload: z.input<Schema>,
    {
      availableAt,
      dedupeKey,
      maxAttempts,
      priority = 0,
      queue = "default",
      tx,
    }: QueueDispatchOptions = {},
  ): Promise<QueueDispatchResult> {
    const key = `${task.pluginId}:${task.name}`;
    const registered = this.c
      .get("core")
      .queue.find(
        entry => entry.pluginId === task.pluginId && entry.name === task.name,
      );

    if (registered === undefined) {
      throw new QueueTaskRegistrationError(
        `Queue task "${key}" is not registered, so nothing would run it. Add it to the queueTasks of a top-level module of "${task.pluginId}", and make sure that plugin is in the API config.`,
      );
    }
    if (
      registered.payload !== task.payload ||
      registered.handler !== task.handler
    ) {
      throw new QueueTaskRegistrationError(
        `A different queue task is registered as "${key}" (module "${registered.module}"). Dispatch the definition that module registers, or rename one of them.`,
      );
    }

    const parsed = await parseJsonWire(task.payload, payload, "payload");
    if (!parsed.success) {
      throw new QueuePayloadValidationError(key, parsed.reason);
    }

    const [row] = await (tx ?? this.c.get("db"))
      .insert(core_queue)
      .values({
        pluginId: task.pluginId,
        name: task.name,
        queue,
        payload: parsed.wire as Record<string, unknown>,
        priority,
        dedupeKey: dedupeKey ?? null,
        maxAttempts: maxAttempts ?? registered.maxAttempts ?? 3,
        availableAt: availableAt ?? new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: core_queue.id });

    return row
      ? { deduplicated: false, id: row.id }
      : { deduplicated: true, id: null };
  }
}
