import type { Context } from "hono";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type {
  AnyEventEnvelope,
  EventEmitResult,
  EventsAdapter,
} from "@/api/models/events";

/**
 * In-process event delivery (default). Runs matching listeners sequentially,
 * in registration order (core plugin first, then the app's `plugins` order),
 * inside the emitting request. Single-process by design: listeners only run
 * on the instance that emitted the event - swap the adapter for a broker to
 * fan out across instances.
 */
export const LocalEventsAdapter = (): EventsAdapter => ({
  name: "local",

  publish: async (
    c: Context,
    envelope: AnyEventEnvelope,
  ): Promise<EventEmitResult> => {
    const listeners = c
      .get("core")
      .events.listeners.filter(listener => listener.event === envelope.name);

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
          // eslint-disable-next-line no-console
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
