import type { Context } from "hono";
import type { z } from "zod";

import type {
  BuildQueueTaskReturn,
  QueueTaskDefinition,
} from "@/api/lib/queue";

import { parseJsonWire } from "@/api/lib/json-wire";
import {
  isQueueTaskDefinition,
  QueuePayloadValidationError,
  QueueTaskRegistrationError,
} from "@/api/lib/queue";
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
  /**
   * JSON-serializable data passed to the handler. Defaults to `{}`. When the
   * registered task has a `payload` schema, it is validated against it.
   */
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

/**
 * The options of `dispatch(task, payload, options)`: everything but the task's
 * identity and payload, which the typed task supplies.
 */
export type QueueDispatchOptions = Omit<
  QueueDispatchArgs,
  "name" | "payload" | "pluginId"
>;

/** What `dispatch()` resolves to. */
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

  private async insert(
    {
      availableAt,
      dedupeKey,
      maxAttempts,
      priority = 0,
      queue = "default",
      tx,
    }: QueueDispatchOptions,
    {
      name,
      payload,
      pluginId,
      registered,
    }: {
      name: string;
      payload: Record<string, unknown>;
      pluginId: string;
      registered: BuildQueueTaskReturn | undefined;
    },
  ): Promise<QueueDispatchResult> {
    const [row] = await (tx ?? this.c.get("db"))
      .insert(core_queue)
      .values({
        pluginId,
        name,
        queue,
        payload,
        priority,
        dedupeKey: dedupeKey ?? null,
        maxAttempts: maxAttempts ?? registered?.maxAttempts ?? 3,
        availableAt: availableAt ?? new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: core_queue.id });

    return row
      ? { deduplicated: false, id: row.id }
      : { deduplicated: true, id: null };
  }

  private registered(pluginId: string, name: string) {
    return this.c
      .get("core")
      .queue.find(task => task.pluginId === pluginId && task.name === name);
  }

  private async validated(
    key: string,
    schema: NonNullable<BuildQueueTaskReturn["payload"]>,
    payload: unknown,
  ): Promise<Record<string, unknown>> {
    const parsed = await parseJsonWire(schema, payload, "payload");
    if (!parsed.success) {
      throw new QueuePayloadValidationError(key, parsed.reason);
    }

    return parsed.wire as Record<string, unknown>;
  }

  /**
   * Enqueues a typed task. The payload is type-checked against the task's
   * schema input, copied to JSON and validated before the row is inserted;
   * the JSON (not the schema's output) is stored, and parsed again just
   * before the handler runs. Does not run the task - the queue worker picks
   * it up on a later tick.
   *
   * @throws {QueuePayloadValidationError} When the payload is not JSON or the
   * schema rejects it. Nothing is enqueued.
   * @throws {QueueTaskRegistrationError} When the task is not registered in a
   * top-level module's `queueTasks` of its plugin, or another task is
   * registered under its name.
   */
  async dispatch<Schema extends z.ZodType>(
    task: QueueTaskDefinition<string, string, Schema>,
    payload: z.input<Schema>,
    options?: QueueDispatchOptions,
  ): Promise<QueueDispatchResult>;
  /**
   * Enqueues a task by name. Does not run it - the queue worker picks it up
   * on a later tick. When the registered task has a `payload` schema, the
   * payload is validated against it first.
   *
   * @returns The new row's id, or `{ deduplicated: true, id: null }` when an
   * active task with the same `dedupeKey` already exists.
   * @throws {QueuePayloadValidationError} When the registered task has a
   * schema and the payload does not match it. Nothing is enqueued.
   */
  async dispatch(args: QueueDispatchArgs): Promise<QueueDispatchResult>;
  async dispatch(
    first: QueueDispatchArgs | QueueTaskDefinition,
    typedPayload?: unknown,
    options: QueueDispatchOptions = {},
  ): Promise<QueueDispatchResult> {
    if (isQueueTaskDefinition(first)) {
      const key = `${first.pluginId}:${first.name}`;
      const registered = this.registered(first.pluginId, first.name);

      if (registered === undefined) {
        throw new QueueTaskRegistrationError(
          `Queue task "${key}" is not registered, so nothing would run it. Add it to the queueTasks of a top-level module of "${first.pluginId}", and make sure that plugin is in the API config.`,
        );
      }
      if (
        registered.payload !== first.payload ||
        registered.handler !== first.handler
      ) {
        throw new QueueTaskRegistrationError(
          `A different queue task is registered as "${key}" (module "${registered.module}"). Dispatch the definition that module registers, or rename one of them.`,
        );
      }

      return await this.insert(options, {
        name: first.name,
        payload: await this.validated(key, first.payload, typedPayload),
        pluginId: first.pluginId,
        registered,
      });
    }

    const { name, payload = {}, pluginId: explicitPluginId, ...rest } = first;
    const pluginId =
      explicitPluginId ?? this.c.get("plugin")?.id ?? "@vitnode/core";
    const registered = this.registered(pluginId, name);

    return await this.insert(rest, {
      name,
      payload:
        registered?.payload === undefined
          ? payload
          : await this.validated(
              `${pluginId}:${name}`,
              registered.payload,
              payload,
            ),
      pluginId,
      registered,
    });
  }
}
