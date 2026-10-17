import type { Context } from "hono";

import type { EventListenerConfig } from "@/api/lib/events";
import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type {
  EventEmitResult,
  EventEnvelope,
  EventsApiPlugin,
} from "@/api/models/events";

// Indexed once per listener list - which is built at boot - so an emit is a map
// lookup.
const listenerIndexes = new WeakMap<
  readonly EventListenerConfig[],
  Map<string, EventListenerConfig[]>
>();

const listenersOf = (
  all: readonly EventListenerConfig[],
  event: string,
): readonly EventListenerConfig[] => {
  let index = listenerIndexes.get(all);
  if (!index) {
    index = new Map();
    for (const listener of all) {
      const bucket = index.get(listener.event);
      if (bucket) bucket.push(listener);
      else index.set(listener.event, [listener]);
    }
    listenerIndexes.set(all, index);
  }

  return index.get(event) ?? [];
};

export const LocalEventsAdapter = (): EventsApiPlugin => ({
  name: "local",

  publish: async (
    c: Context,
    envelope: EventEnvelope,
  ): Promise<EventEmitResult> => {
    // Run one after another, in registration order.
    const listeners = listenersOf(
      c.get("core").events.listeners,
      envelope.name,
    );

    const failures: EventEmitResult["failures"] = [];
    let delivered = 0;

    for (const listener of listeners) {
      try {
        await listener.handler(
          c as Context<EnvVitNode>,
          envelope.payload,
          envelope,
        );
        delivered++;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        failures.push({
          pluginId: listener.pluginId,
          module: listener.module,
          listener: listener.name,
          error,
        });
        const message = `Event listener "${listener.pluginId}:${listener.module}:${listener.name}" for "${envelope.name}" failed: ${error}`;
        try {
          await c.get("log").error(message);
        } catch {
          // oxlint-disable-next-line no-console
          console.error(
            `[VitNode] Failed to log event listener failure: ${message}`,
          );
        }
      }
    }

    return {
      eventId: envelope.eventId,
      status: "delivered",
      delivered,
      failures,
    };
  },
});
