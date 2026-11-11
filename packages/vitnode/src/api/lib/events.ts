import type { Context } from "hono";
import type { z } from "zod";

import type { EnvVitNode } from "../middlewares/global.middleware";
import type { EventEnvelope } from "../models/events";
import type { EventDefinition } from "./event-definition";

/**
 * A listener for one event, as returned by {@link buildEventListener}.
 *
 * Register it in a top-level module's `events` array (`buildModule({ events })`);
 * listeners in nested modules are not collected.
 */
export interface BuildEventListenerReturn {
  /** The listened-to event. Its emits are validated before this listener runs. */
  definition: EventDefinition;
  /** Human-readable note for developers; not shown to end users. */
  description?: string;
  /** The event's name, `definition.name` - what adapters match listeners on. */
  event: string;
  /**
   * Runs for every emit of `event`, with the emitter's request context and the
   * schema's output.
   *
   * With the default local adapter, listeners run one after another and the
   * emitter awaits them all. A thrown error is logged and reported in the
   * emitter's `EventEmitResult.failures`; it never reaches the emitter and
   * does not stop the remaining listeners.
   */
  handler: (
    c: Context<EnvVitNode>,
    payload: unknown,
    envelope: EventEnvelope,
  ) => Promise<void> | void;
  /** Identifies the listener in logs and failure reports. */
  name: string;
}

/** A listener after registration, tagged with the module and plugin that declared it. */
export interface EventListenerConfig extends BuildEventListenerReturn {
  module: string;
  pluginId: string;
}

export interface EventListenerOptions<Schema extends z.ZodType> {
  /** Human-readable note for developers; not shown to end users. */
  description?: string;
  /** The event definition from `defineEvent`, possibly another plugin's. */
  event: EventDefinition<string, string, Schema>;
  /**
   * Runs for every emit of `event` with the schema's output - validated once,
   * before the first listener. A thrown error is logged and reported in the
   * emitter's `EventEmitResult.failures`, never rethrown.
   */
  handler: (
    c: Context<EnvVitNode>,
    payload: z.output<Schema>,
    envelope: EventEnvelope<z.output<Schema>>,
  ) => Promise<void> | void;
  /** Identifies the listener in logs and failure reports. */
  name: string;
}

/**
 * Declares a server-side listener for a schema-defined event. The payload is
 * typed from the definition's schema output. Listen to another plugin's event
 * by importing its definition; a Content Engine event comes from
 * `contentEvent(contentType, action)`.
 *
 * @example
 * ```ts
 * import { userCreatedEvent } from "@vitnode/core/api/events/users";
 * import { buildEventListener } from "@vitnode/core/api/lib/events";
 *
 * export const welcomeListener = buildEventListener({
 *   event: userCreatedEvent,
 *   name: "send-welcome",
 *   handler: async (c, payload) => {
 *     await c.get("log").debug(`Welcome, ${payload.name}`);
 *   },
 * });
 *
 * // buildModule({ name: "users", routes: [], events: [welcomeListener] })
 * ```
 */
export const buildEventListener = <Schema extends z.ZodType>({
  description,
  event,
  handler,
  name,
}: EventListenerOptions<Schema>): BuildEventListenerReturn =>
  // Listeners are matched by name at dispatch time and receive the payload
  // the definition's schema produced; the cast erases the per-event payload
  // type so listeners for different events can share one array.
  ({
    definition: event,
    description,
    event: event.name,
    handler: handler as BuildEventListenerReturn["handler"],
    name,
  });
