import type { Context } from "hono";
import type { z } from "zod";

import type { EnvVitNode } from "../middlewares/global.middleware";
import type { JsonWireObjectCheck } from "./json-wire";

/**
 * A queue task: its payload schema, owning plugin and name, as the
 * plugin-bound `buildQueueTask` returns it. Register it in a top-level
 * module's `queueTasks`, then dispatch it with
 * `c.get("queue").dispatch(task, payload)`.
 *
 * With its default type parameters it stands for any task, as the registry
 * holds them.
 */
export interface QueueTaskDefinition<
  Plugin extends string = string,
  Name extends string = string,
  Schema extends z.ZodType = z.ZodType,
> {
  /** A note on what the task does. Kept on the definition only; core does not display it. */
  readonly description?: string;
  /**
   * Runs once per claimed task with the schema's output, parsed from the
   * stored JSON just before it runs. A stored payload the schema rejects
   * fails the task at once, without a retry.
   *
   * Returning completes the task. Throwing retries it with exponential backoff
   * (10 s, doubling, capped at 1 hour) until `maxAttempts` is reached, then
   * marks it failed. Throw {@link QueueDeferError} to postpone without using
   * up an attempt.
   */
  // oxlint-disable-next-line typescript/method-signature-style -- bivariant, so every typed task fits the registry
  handler(
    c: Context<EnvVitNode>,
    payload: z.output<Schema>,
  ): Promise<void> | void;
  /**
   * Seconds a worker may hold a claimed task before it is treated as
   * abandoned and returned to the queue (or failed, once out of attempts).
   * Defaults to 600.
   */
  readonly leaseSeconds?: number;
  /** Attempt limit for dispatches without their own `maxAttempts`. Defaults to 3. */
  readonly maxAttempts?: number;
  /** Unique within the plugin: stored rows are matched to the task by plugin id and name. */
  readonly name: Name;
  /** Validates the payload when it is dispatched and again just before the handler runs. */
  readonly payload: Schema;
  /** The owning plugin. Rows are stored under it, whichever plugin dispatches. */
  readonly pluginId: Plugin;
}

/** A queue task after registration, tagged with the module that declared it. */
export interface QueueTaskConfig extends QueueTaskDefinition {
  readonly module: string;
}

/** What `dispatch(task, payload)` accepts: the schema's input. */
export type QueueTaskInput<Task extends QueueTaskDefinition> = z.input<
  Task["payload"]
>;

/** What a task's handler receives: the schema's output. */
export type QueueTaskPayload<Task extends QueueTaskDefinition> = z.output<
  Task["payload"]
>;

export interface QueueTaskOptions<
  Plugin extends string,
  Name extends string,
  Schema extends z.ZodType,
> {
  /** A note on what the task does. */
  description?: string;
  /** See {@link QueueTaskDefinition.handler}. */
  handler: (
    c: Context<EnvVitNode>,
    payload: z.output<Schema>,
  ) => Promise<void> | void;
  /**
   * Seconds a worker may hold a claimed task before it is treated as
   * abandoned. Defaults to 600. Raise it for tasks that legitimately run
   * longer.
   */
  leaseSeconds?: number;
  /** Attempt limit for dispatches without their own `maxAttempts`. Defaults to 3. */
  maxAttempts?: number;
  /** Unique within the plugin. Keep it when the schema changes: pending rows are found by it. */
  name: Name;
  /**
   * Validates the payload when it is dispatched and again just before the
   * handler runs. Its input must be a JSON object - the payload is stored as
   * JSON and parsed back - so use `z.iso.datetime()` rather than `z.date()`,
   * and `z.object({})` for a task without data. Rows already stored keep
   * their old JSON, so a changed schema must still accept it.
   */
  payload: JsonWireObjectCheck<Schema> & Schema;
  /** The owning plugin's id. The plugin-bound `buildQueueTask` fills it in. */
  pluginId: Plugin;
}

/**
 * Declares durable background work stored in the `core_queue` table. Use the
 * plugin-bound `buildQueueTask` from your plugin's `@/api/builders`
 * (`bindApiPlugin`), which fills in `pluginId`, and add the task to a
 * top-level module's `queueTasks`.
 *
 * Dispatch it with `c.get("queue").dispatch(task, payload)`, which
 * type-checks the payload and validates it before inserting.
 *
 * Tasks are processed by the core `process-queue` cron job (every minute, up
 * to 25 per tick, highest `priority` first), so a cron adapter or an external
 * cron trigger must be running.
 *
 * @example
 * ```ts
 * // src/api/modules/posts/tasks/reindex-post.task.ts
 * import { z } from "zod";
 *
 * import { buildQueueTask } from "@/api/builders";
 *
 * export const reindexPostTask = buildQueueTask({
 *   name: "reindex-post",
 *   payload: z.object({ postId: z.number().int().positive() }),
 *   maxAttempts: 5,
 *   handler: async (c, { postId }) => {
 *     // postId is a number here
 *   },
 * });
 *
 * // In a route:
 * await c.get("queue").dispatch(reindexPostTask, { postId: 42 });
 * ```
 */
export const buildQueueTask = <
  const Plugin extends string,
  const Name extends string,
  Schema extends z.ZodType,
>({
  name,
  handler,
  description,
  leaseSeconds,
  maxAttempts,
  payload,
  pluginId,
}: QueueTaskOptions<Plugin, Name, Schema>): QueueTaskDefinition<
  Plugin,
  Name,
  Schema
> => ({
  name,
  handler,
  description,
  leaseSeconds,
  maxAttempts,
  payload,
  pluginId,
});

/**
 * Whether a value is a queue task definition: a handler, a payload schema
 * and an owning plugin.
 */
export const isQueueTaskDefinition = (
  value: unknown,
): value is QueueTaskDefinition =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { handler?: unknown }).handler === "function" &&
  typeof (value as { name?: unknown }).name === "string" &&
  typeof (value as { payload?: unknown }).payload === "object" &&
  (value as { payload?: unknown }).payload !== null &&
  typeof (value as { pluginId?: unknown }).pluginId === "string";

/**
 * Thrown by `dispatch()` when a payload does not match the task's schema, or
 * is not JSON. Nothing was enqueued. The message names paths and issue codes,
 * never values.
 */
export class QueuePayloadValidationError extends Error {
  constructor(task: string, reason: string) {
    super(
      `Queue task "${task}" was not dispatched: invalid payload - ${reason}`,
    );
    this.name = "QueuePayloadValidationError";
    this.task = task;
    this.reason = reason;
  }

  readonly reason: string;
  readonly task: string;
}

/**
 * Thrown by `dispatch(task, payload)` when the task is not registered in the
 * running API, or a different task is registered under its name, and by
 * `buildApiPlugin` when a task is not a queue task definition, is registered
 * by another plugin, or shares its name with a different task. Nothing was
 * enqueued.
 */
export class QueueTaskRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueTaskRegistrationError";
  }
}

/**
 * Checks one plugin's queue tasks when the plugin is built, without running a
 * handler: each must be a queue task definition built for this plugin, and
 * no two different tasks may share a name. The same definition listed twice
 * is kept once.
 *
 * @throws {QueueTaskRegistrationError}
 */
export const collectPluginQueueTasks = <Task extends QueueTaskConfig>(
  pluginId: string,
  tasks: readonly Task[],
): Task[] => {
  const byName = new Map<string, Task>();

  for (const task of tasks) {
    const candidate: unknown = task;
    if (!isQueueTaskDefinition(candidate)) {
      throw new QueueTaskRegistrationError(
        `Queue task "${task.name}" in module "${task.module}" of plugin "${pluginId}" is not a queue task definition. Build it with the plugin-bound buildQueueTask from "@/api/builders" and a payload schema - z.object({}) when it takes no data.`,
      );
    }
    if (task.pluginId !== pluginId) {
      throw new QueueTaskRegistrationError(
        `Queue task "${task.pluginId}:${task.name}" is registered by plugin "${pluginId}" (module "${task.module}"). A task can only be registered by the plugin that defines it - its pending rows are stored under "${task.pluginId}".`,
      );
    }

    const previous = byName.get(task.name);
    if (previous === undefined) {
      byName.set(task.name, task);
      continue;
    }
    if (
      previous.handler !== task.handler ||
      previous.payload !== task.payload
    ) {
      throw new QueueTaskRegistrationError(
        `Plugin "${pluginId}" registers two different queue tasks named "${task.name}" (modules "${previous.module}" and "${task.module}"). Rows are matched to a handler by plugin and name, so rename one of them.`,
      );
    }
  }

  return [...byName.values()];
};

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
