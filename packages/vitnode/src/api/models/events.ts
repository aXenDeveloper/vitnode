import type { Context } from "hono";
import type { z } from "zod";

import { randomUUID } from "node:crypto";

import type { EventDefinition } from "../lib/event-definition";
import type { EventListenerConfig } from "../lib/events";

import {
  EventDefinitionError,
  EventPayloadValidationError,
} from "../lib/event-definition";
import { parseJsonWire } from "../lib/json-wire";

/**
 * Who caused an event, resolved from the emitting request: the admin on an
 * AdminCP route, else the signed-in user, else `system` (cron, queue tasks,
 * guests).
 */
export interface EventActor {
  id?: number;
  type: "admin" | "system" | "user";
}

/**
 * An emitted event with its metadata, passed to listeners and adapters.
 * `Payload` is the event schema's output; adapters see `unknown`.
 */
export interface EventEnvelope<Payload = unknown> {
  /** Who caused the event. */
  actor: EventActor;
  /** When `emit()` was called. */
  emittedAt: Date;
  /** A random UUID, unique per emit; also returned in the result. */
  eventId: string;
  /** The event name, e.g. `"role.created"`. */
  name: string;
  /** The event's data: its schema's output, validated before any listener ran. */
  payload: Payload;
  /** Plugin that emitted the event. */
  pluginId: string;
}

/** One listener (or the adapter itself) that failed to handle an event. */
export interface EventEmitFailure {
  /** The thrown error's message. */
  error: string;
  /** Listener `name` as declared in `buildEventListener`. */
  listener: string;
  module: string;
  /** Plugin that owns the failing listener. */
  pluginId: string;
}

/** What `emit()` reports back about delivery. */
export interface EventEmitResult {
  /** Listeners that ran successfully before `emit()` resolved. */
  delivered: number;
  /** The emitted envelope's id. */
  eventId: string;
  /** Listeners that threw. When the adapter itself throws, one entry with `module: "adapter"`. */
  failures: EventEmitFailure[];

  /** `delivered` when listeners ran before `emit()` resolved (the local adapter); `queued` when an adapter hands the event off. */
  status: "delivered" | "queued";
}

/**
 * Transport for events, set as `events.adapter` in the API config. Defaults to
 * the in-process local adapter, which runs matching listeners sequentially
 * inside the emitting request.
 *
 * A custom adapter may deliver elsewhere and report `status: "queued"`.
 * Throwing from `publish` is caught by `emit()`, logged, and reported as a
 * failure.
 */
export interface EventsApiPlugin {
  /** Shown in logs and returned by `c.get("events").name()`, e.g. `"local"`. */
  name: string;
  /** Delivers one event to its listeners (read them from `c.get("core").events.listeners`) or hands it off. */
  publish: (c: Context, envelope: EventEnvelope) => Promise<EventEmitResult>;
}

export interface EventEmitOptions {
  /**
   * Plugin recorded as the emitter. Defaults to the plugin of the current
   * route, then `@vitnode/core`.
   */
  pluginId?: string;
}

/** Server-side events API, available as `c.get("events")` in API handlers. */
export class EventsModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  private adapter(): EventsApiPlugin {
    return this.c.get("core").events.adapter;
  }

  private envelope(
    name: string,
    payload: unknown,
    options: EventEmitOptions | undefined,
  ): EventEnvelope {
    const admin = this.c.get("admin");
    const user = this.c.get("user");

    return {
      eventId: randomUUID(),
      name,
      payload,
      emittedAt: new Date(),
      pluginId:
        options?.pluginId ?? this.c.get("plugin")?.id ?? "@vitnode/core",
      actor: admin
        ? { type: "admin", id: admin.user.id }
        : user
          ? { type: "user", id: user.id }
          : { type: "system" },
    };
  }

  private async publish(envelope: EventEnvelope): Promise<EventEmitResult> {
    const adapter = this.adapter();

    try {
      return await adapter.publish(this.c, envelope);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.c
        .get("log")
        .error(
          `Events adapter "${adapter.name}" failed to publish "${envelope.name}": ${error}`,
        );

      return {
        eventId: envelope.eventId,
        status: "delivered",
        delivered: 0,
        failures: [
          {
            pluginId: envelope.pluginId,
            module: "adapter",
            listener: adapter.name,
            error,
          },
        ],
      };
    }
  }

  /**
   * Emits a schema-defined event. The payload is type-checked against the
   * schema's input, copied to JSON and validated before the adapter or any
   * listener sees it; listeners receive the schema's output. Listener and
   * adapter errors are logged and returned in `failures`, never thrown.
   *
   * With the local adapter the promise resolves after every listener has
   * finished, so await it when listeners must run before the response, and
   * keep listeners fast.
   *
   * @throws {EventPayloadValidationError} When the payload is not JSON or the
   * schema rejects it. Nothing was delivered.
   * @throws {EventDefinitionError} When a different definition is registered
   * under the same name.
   *
   * @example
   * ```ts
   * import { roleCreatedEvent } from "@vitnode/core/api/events/roles";
   *
   * await c.get("events").emit(roleCreatedEvent, { roleId: role.id });
   * ```
   */
  async emit<Schema extends z.ZodType>(
    event: EventDefinition<string, string, Schema>,
    payload: z.input<Schema>,
    options?: EventEmitOptions,
  ): Promise<EventEmitResult> {
    const registered = this.c.get("core").events.definitions?.get(event.name);
    if (
      registered !== undefined &&
      registered !== event &&
      (registered.payload !== event.payload ||
        registered.pluginId !== event.pluginId)
    ) {
      throw new EventDefinitionError(
        `A different definition of the event "${event.name}" is registered (by "${registered.pluginId}"). Emit the registered definition, or rename one of them.`,
      );
    }

    const parsed = await parseJsonWire(event.payload, payload, "payload");
    if (!parsed.success) {
      throw new EventPayloadValidationError(event.name, parsed.reason);
    }

    return await this.publish(this.envelope(event.name, parsed.data, options));
  }

  /** Name of the configured adapter, e.g. `"local"`. */
  name(): string {
    return this.adapter().name;
  }
}

export type { EventListenerConfig };
