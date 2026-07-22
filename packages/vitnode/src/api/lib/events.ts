import type { Context } from "hono";

import type { EnvVitNode } from "../middlewares/global.middleware";
import type {
  EventEnvelope,
  VitNodeEventName,
  VitNodeEvents,
} from "../models/events";

export interface BuildEventListenerReturn<
  K extends VitNodeEventName = VitNodeEventName,
> {
  description?: string;
  event: K;
  handler: (
    c: Context<EnvVitNode>,
    payload: VitNodeEvents[K],
    envelope: EventEnvelope<K>,
  ) => Promise<void> | void;
  name: string;
}

export interface EventListenerConfig extends BuildEventListenerReturn {
  module: string;
  pluginId: string;
}

export function buildEventListener<K extends VitNodeEventName>(
  args: BuildEventListenerReturn<K>,
): BuildEventListenerReturn {
  // Listeners are matched by `event` at dispatch time; the cast erases the
  // per-event generic so listeners for different events can share one array.
  return args as unknown as BuildEventListenerReturn;
}
