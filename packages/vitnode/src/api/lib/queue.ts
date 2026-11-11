import type { Context } from "hono";
import type { z } from "zod";

import type { EnvVitNode } from "../middlewares/global.middleware";
import type { JsonWireObjectCheck } from "./json-wire";

/** A background task handler, as returned by {@link buildQueueTask}. */
export interface BuildQueueTaskReturn {
  /** A note on what the task does. Kept on the definition only; core does not display it. */
  description?: string;
  /**
   * Runs once per claimed task with the payload given to `dispatch()`. A task
   * without a `payload` schema gets the stored JSON as-is, so validate it
   * before use; a task with one gets the schema's output.
   *
   * Returning completes the task. Throwing retries it with exponential backoff
   * (10 s, doubling, capped at 1 hour) until `maxAttempts` is reached, then
   * marks it failed. Throw {@link QueueDeferError} to postpone without using
   * up an attempt.
   */
  // oxlint-disable-next-line typescript/method-signature-style -- bivariant, so a typed task fits the registry
  handler(
    c: Context<EnvVitNode>,
    payload: Record<string, unknown>,
  ): Promise<void> | void;
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
  /** The payload schema of a typed task ({@link QueueTaskDefinition}). */
  payload?: z.ZodType;
  /** The owning plugin of a typed task ({@link QueueTaskDefinition}). */
  pluginId?: string;
}

/** A queue task after registration, tagged with the module and plugin that declared it. */
export interface QueueTaskConfig extends BuildQueueTaskReturn {
  module: string;
  pluginId: string;
}

/**
 * A typed queue task: its payload schema, owning plugin and name, as
 * `bindApiPlugin(manifest).buildQueueTask` returns it. Register it in a
 * top-level module's `queueTasks`, then dispatch it with
 * `c.get("queue").dispatch(task, payload)`.
 */
export interface QueueTaskDefinition<
  Plugin extends string = string,
  Name extends string = string,
  Schema extends z.ZodType = z.ZodType,
> {
  readonly description?: string;
  /** Receives the schema's output, parsed from the stored JSON just before it runs. */
  readonly handler: (
    c: Context<EnvVitNode>,
    payload: z.output<Schema>,
  ) => Promise<void> | void;
  readonly leaseSeconds?: number;
  readonly maxAttempts?: number;
  readonly name: Name;
  readonly payload: Schema;
  readonly pluginId: Plugin;
}

/** What `dispatch(task, payload)` accepts for a typed task: the schema's input. */
export type QueueTaskInput<Task extends QueueTaskDefinition> = z.input<
  Task["payload"]
>;

/** What a typed task's handler receives: the schema's output. */
export type QueueTaskPayload<Task extends QueueTaskDefinition> = z.output<
  Task["payload"]
>;

/** What {@link buildQueueTask} takes for a typed task. */
export interface QueueTaskOptions<
  Plugin extends string,
  Name extends string,
  Schema extends z.ZodType,
> {
  /** A note on what the task does. */
  description?: string;
  /**
   * Runs once per claimed task with the payload parsed by `payload`. A stored
   * payload the schema rejects fails the task at once, without a retry.
   */
  handler: (
    c: Context<EnvVitNode>,
    payload: z.output<Schema>,
  ) => Promise<void> | void;
  /** See {@link BuildQueueTaskReturn.leaseSeconds}. Defaults to 600. */
  leaseSeconds?: number;
  /** See {@link BuildQueueTaskReturn.maxAttempts}. Defaults to 3. */
  maxAttempts?: number;
  /** Unique within the plugin. Keep it when the schema changes: pending rows are found by it. */
  name: Name;
  /**
   * Validates the payload when it is dispatched and again just before the
   * handler runs. Its input must be JSON - the payload is stored as JSON and
   * parsed back - so use `z.iso.datetime()` rather than `z.date()`.
   */
  payload: JsonWireObjectCheck<Schema> & Schema;
  /** The owning plugin's id. `bindApiPlugin(manifest).buildQueueTask` fills it in. */
  pluginId: Plugin;
}

/** What {@link buildQueueTask} takes for an untyped task. */
export type UntypedQueueTaskOptions = Omit<
  BuildQueueTaskReturn,
  "payload" | "pluginId"
>;

/**
 * Declares a handler for durable background work stored in the `core_queue`
 * table. Add it to a top-level module's `queueTasks` array.
 *
 * With a `payload` schema (and the owning `pluginId`, which the plugin-bound
 * builder from `bindApiPlugin` fills in) it returns a typed
 * {@link QueueTaskDefinition}: dispatch it with
 * `c.get("queue").dispatch(task, payload)`, which type-checks the payload and
 * validates it before inserting. Without one it is an untyped task, dispatched
 * by name: `c.get("queue").dispatch({ name, payload })`.
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
export function buildQueueTask<
  const Plugin extends string,
  const Name extends string,
  Schema extends z.ZodType,
>(
  options: QueueTaskOptions<Plugin, Name, Schema>,
): QueueTaskDefinition<Plugin, Name, Schema>;
export function buildQueueTask(
  options: UntypedQueueTaskOptions,
): BuildQueueTaskReturn;
export function buildQueueTask({
  name,
  handler,
  description,
  leaseSeconds,
  maxAttempts,
  payload,
  pluginId,
}: BuildQueueTaskReturn): BuildQueueTaskReturn {
  return payload === undefined
    ? { name, handler, description, leaseSeconds, maxAttempts }
    : {
        name,
        handler,
        description,
        leaseSeconds,
        maxAttempts,
        payload,
        pluginId,
      };
}

/** Whether a value is a typed task definition rather than `dispatch()` arguments. */
export const isQueueTaskDefinition = (
  value: unknown,
): value is QueueTaskDefinition =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { handler?: unknown }).handler === "function" &&
  typeof (value as { payload?: unknown }).payload === "object" &&
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
 * Thrown by `dispatch(task, payload)` when the typed task is not registered
 * in the running API, or a different task is registered under its name, and
 * by `buildApiPlugin` when a typed task is registered twice or by another
 * plugin. Nothing was enqueued.
 */
export class QueueTaskRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueTaskRegistrationError";
  }
}

/**
 * Checks one plugin's queue tasks when the plugin is built, without running a
 * handler: a typed task must belong to the plugin registering it, and a typed
 * task's name must not be taken by another task. The same definition listed
 * twice is kept once.
 *
 * @throws {QueueTaskRegistrationError}
 */
export const collectPluginQueueTasks = <Task extends BuildQueueTaskReturn>(
  pluginId: string,
  tasks: readonly (Task & { module: string })[],
): (Task & { module: string })[] => {
  const byName = new Map<string, Task & { module: string }>();

  for (const task of tasks) {
    if (task.pluginId !== undefined && task.pluginId !== pluginId) {
      throw new QueueTaskRegistrationError(
        `Queue task "${task.pluginId}:${task.name}" is registered by plugin "${pluginId}" (module "${task.module}"). A typed task can only be registered by the plugin that defines it - its pending rows are stored under "${task.pluginId}".`,
      );
    }

    const previous = byName.get(task.name);
    if (previous === undefined) {
      byName.set(task.name, task);
      continue;
    }
    const same =
      previous.handler === task.handler && previous.payload === task.payload;
    if (same) continue;
    if (previous.payload !== undefined || task.payload !== undefined) {
      throw new QueueTaskRegistrationError(
        `Plugin "${pluginId}" registers two different queue tasks named "${task.name}" (modules "${previous.module}" and "${task.module}"). Rows are matched to a handler by plugin and name, so rename one of them.`,
      );
    }
  }

  return tasks.filter(
    (task, index) =>
      tasks.findIndex(
        other =>
          other.name === task.name &&
          other.handler === task.handler &&
          other.payload === task.payload,
      ) === index,
  );
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
