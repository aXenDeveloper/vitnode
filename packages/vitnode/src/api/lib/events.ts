import type { Context } from "hono";

import type { EnvVitNode } from "../middlewares/global.middleware";
import type {
  EventEnvelope,
  VitNodeEventName,
  VitNodeEvents,
} from "../models/events";

/**
 * A listener for one VitNode event, as returned by {@link buildEventListener}.
 *
 * Register it in a top-level module's `events` array (`buildModule({ events })`);
 * listeners in nested modules are not collected.
 */
export interface BuildEventListenerReturn<
  K extends VitNodeEventName = VitNodeEventName,
> {
  /** Human-readable note for developers; not shown to end users. */
  description?: string;
  /** The event to react to - a key of `VitNodeEvents`. */
  event: K;
  /**
   * Runs for every emit of `event`, with the emitter's request context.
   *
   * With the default local adapter, listeners run one after another and the
   * emitter awaits them all. A thrown error is logged and reported in the
   * emitter's `EventEmitResult.failures`; it never reaches the emitter and
   * does not stop the remaining listeners.
   */
  handler: (
    c: Context<EnvVitNode>,
    payload: VitNodeEvents[K],
    envelope: EventEnvelope<K>,
  ) => Promise<void> | void;
  /** Identifies the listener in logs and failure reports. */
  name: string;
}

/** A listener after registration, tagged with the module and plugin that declared it. */
export interface EventListenerConfig extends BuildEventListenerReturn {
  module: string;
  pluginId: string;
}

/**
 * Declares a server-side listener for a VitNode event, with the payload typed
 * from `event`.
 *
 * Add your own events by augmenting `VitNodeEvents` in
 * `@vitnode/core/api/models/events`, and emit them with
 * `c.get("events").emit(name, payload)`.
 *
 * @example
 * ```ts
 * import { buildEventListener } from "@vitnode/core/api/lib/events";
 *
 * export const welcomeListener = buildEventListener({
 *   event: "user.created",
 *   name: "send-welcome",
 *   handler: async (c, payload) => {
 *     await c.get("log").debug(`Welcome, ${payload.name}`);
 *   },
 * });
 *
 * // buildModule({ name: "users", routes: [], events: [welcomeListener] })
 * ```
 */
export function buildEventListener<K extends VitNodeEventName>(
  args: BuildEventListenerReturn<K>,
): BuildEventListenerReturn {
  // Listeners are matched by `event` at dispatch time; the cast erases the
  // per-event generic so listeners for different events can share one array.
  return args as unknown as BuildEventListenerReturn;
}
