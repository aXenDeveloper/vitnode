import type { CacheClient } from "@/api/lib/cache";

import type { ConnectionCloseListener } from "./create-registry";
import type { RealtimeDeliveryCommand } from "./realtime";
import type {
  InstanceMessageListener,
  RealtimeRuntime,
  RemoteRoomListener,
} from "./runtime";

import { createWebSocketRegistry } from "./create-registry";
import { realtimeFromCommands } from "./realtime";
import {
  createListenerSet,
  createServiceStore,
  currentRealtimeScope,
  deliverToRegistry,
  runRealtimeHostCommand,
  setProcessRealtimeRuntime,
} from "./runtime";

const SHARED_CLOSE_LISTENERS_KEY = Symbol.for("vitnode.ws.close-listeners");

/**
 * Close listeners plugins register at module load with
 * `wsRegistry.onConnectionClose`. Every registry runs them - the process one
 * and each Cloudflare hub's - because a module-level registration cannot know
 * which host will own the sockets. On `globalThis`, because the hub may be
 * built from a different bundle's copy of this module than the plugin's.
 */
export const sharedCloseListeners: Set<ConnectionCloseListener> = ((
  globalThis as typeof globalThis & {
    [SHARED_CLOSE_LISTENERS_KEY]?: Set<ConnectionCloseListener>;
  }
)[SHARED_CLOSE_LISTENERS_KEY] ??= new Set());

/** The sockets of this Node/Bun process. */
export const processRegistry = createWebSocketRegistry({
  sharedCloseListeners,
});

const REALTIME_PUBSUB_CHANNEL = "vitnode:ws";

let instanceIdValue: string | undefined;

/**
 * Unique per process. Tagged onto every published message so the instance that
 * sent it can ignore its own echo (it already delivered to its local clients).
 * Created on first use: Workers forbid random values at module load.
 */
const instanceId = (): string => (instanceIdValue ??= crypto.randomUUID());

let publisher: CacheClient | null = null;

/**
 * Whether the Redis pub/sub bridge for cross-instance realtime is active. When
 * `false`, pushes only reach clients on the current instance.
 */
export const isRealtimePubSubEnabled = (): boolean => publisher !== null;

export const getRealtimeInstanceId = (): string => instanceId();

type RealtimePubSubMessage =
  | (RealtimeDeliveryCommand & { origin: string })
  | { data: unknown; id: string; origin: string; type: "instance" };

const roomListeners = createListenerSet<Parameters<RemoteRoomListener>>(
  "Realtime remote room",
);
const instanceListeners = createListenerSet<
  Parameters<InstanceMessageListener>
>("Realtime instance message");

/**
 * The pub/sub wire format, unchanged from earlier releases so instances of the
 * old and the new version deliver each other's messages during a deploy.
 */
const toWire = (
  message:
    | RealtimeDeliveryCommand
    | { data: unknown; id: string; type: "instance" },
): Record<string, unknown> => {
  switch (message.type) {
    case "closeUser": {
      return {
        data: message.deviceId,
        id: "closeUser",
        type: "closeUser",
        userId: message.userId,
      };
    }
    case "sendToUsers": {
      return { data: message.messages, id: message.id, type: "sendToUsers" };
    }
    case "toRoom": {
      return {
        data: message.data,
        id: message.id,
        room: message.room,
        type: "room",
      };
    }
    default: {
      return message;
    }
  }
};

const publish = (
  message:
    | RealtimeDeliveryCommand
    | { data: unknown; id: string; type: "instance" },
): void => {
  if (!publisher) return;

  const task = publisher
    .publish(
      REALTIME_PUBSUB_CHANNEL,
      JSON.stringify({ ...toWire(message), origin: instanceId() }),
    )
    .catch(() => {
      // Other instances miss this message, but the local clients were already
      // served directly, so realtime keeps working on this instance.
    });
  currentRealtimeScope()?.keepAlive?.(task);
};

const isNumber = (value: unknown): value is number => typeof value === "number";

/** Reads a pub/sub payload written by {@link toWire}. */
const parsePubSubMessage = (raw: string): null | RealtimePubSubMessage => {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null) return null;
  const message = value as Record<string, unknown>;
  const { data, id, origin, room, type, userId } = message;
  if (typeof origin !== "string") return null;

  switch (type) {
    case "broadcast":
    case "instance": {
      return typeof id === "string" ? { data, id, origin, type } : null;
    }
    case "closeUser": {
      if (!isNumber(userId)) return null;
      return {
        deviceId: isNumber(data) ? data : null,
        origin,
        type,
        userId,
      };
    }
    case "room": {
      return typeof id === "string" && typeof room === "string"
        ? { data, id, origin, room, type: "toRoom" }
        : null;
    }
    case "sendToUser": {
      return typeof id === "string" && isNumber(userId)
        ? { data, id, origin, type, userId }
        : null;
    }
    case "sendToUsers": {
      const batch = data;
      if (typeof id !== "string" || !Array.isArray(batch)) return null;

      return {
        id,
        messages: batch.flatMap((entry: unknown) =>
          typeof entry === "object" &&
          entry !== null &&
          "userId" in entry &&
          isNumber(entry.userId) &&
          "data" in entry
            ? [{ data: entry.data, userId: entry.userId }]
            : [],
        ),
        origin,
        type,
      };
    }
    default: {
      return null;
    }
  }
};

type PubSubState = "connecting" | "down" | "ready";

let pubSubState: PubSubState = "connecting";
const readyWaiters = new Set<() => void>();

const setPubSubState = (state: PubSubState): void => {
  pubSubState = state;
  if (state !== "ready") return;
  readyWaiters.forEach(resolve => resolve());
  readyWaiters.clear();
};

/**
 * Pub/Sub has no replay, so a socket that stayed open while this instance was
 * unsubscribed may have missed messages. Closing it makes the client reconnect
 * and run its normal restore: rejoin rooms and reload durable state.
 */
const resyncLocalConnections = (): void => {
  // oxlint-disable-next-line no-console
  console.warn(
    "[VitNode] Realtime pub/sub resubscribed after a Redis outage; reconnecting local WebSocket clients so they reload missed state.",
  );
  processRegistry.closeAll(1012, "Realtime resync");
};

/**
 * Resolves `true` once this instance can be reached by every other instance:
 * subscribed to the Redis channel, or running without Redis at all (local
 * delivery only). Resolves `false` when that does not happen within
 * `timeoutMs` - the WebSocket handshake answers `503` then, and the client
 * retries with backoff. Server-only.
 */
export const waitForRealtimePubSub = async (
  timeoutMs = 5000,
): Promise<boolean> => {
  if (!publisher || pubSubState === "ready") return true;

  return new Promise<boolean>(resolve => {
    const done = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      readyWaiters.delete(done);
      resolve(false);
    }, timeoutMs);
    readyWaiters.add(done);
  });
};

/**
 * Bridges this process's realtime to every other instance through Redis
 * pub/sub. A no-op without Redis, or when already initialized - a dev server
 * that rebuilds the API keeps the first subscription. Node/Bun only: a
 * Cloudflare deployment delivers through its Durable Object hub instead.
 */
export const initRealtimePubSub = (client: CacheClient | null): void => {
  if (!client || publisher) return;

  publisher = client;

  // A connection in subscribe mode can't run other commands, so use a
  // dedicated duplicate for receiving. `duplicate()` returns a disconnected
  // client, hence the explicit `connect()`; node-redis restores the
  // subscription itself after every reconnect, so it is only made once.
  const subscriber = client.duplicate();
  let subscribed = false;
  let subscribing = false;

  const onMessage = (raw: string): void => {
    try {
      const message = parsePubSubMessage(raw);
      // Skip our own echo - the publisher already delivered locally.
      if (!message || message.origin === instanceId()) return;
      if (message.type === "instance") {
        const { data, id: topic, origin } = message;
        instanceListeners.emit({ data, origin, topic });

        return;
      }
      if (message.type === "toRoom") {
        roomListeners.emit(message.room, message.id, message.data);
      }
      deliverToRegistry(processRegistry, message);
    } catch {
      // Ignore malformed payloads.
    }
  };

  // Until this succeeds the instance is not ready: WebSocket handshakes wait
  // for it, so no socket is accepted that other instances cannot reach. A
  // failed attempt is retried on the next `ready`.
  const subscribe = (): void => {
    if (subscribed || subscribing) return;
    subscribing = true;
    subscriber
      .subscribe(REALTIME_PUBSUB_CHANNEL, onMessage)
      .then(() => {
        subscribed = true;
        setPubSubState("ready");
      })
      .catch(() => {
        // Realtime stays single-instance; local clients still get their messages.
      })
      .finally(() => {
        subscribing = false;
      });
  };

  subscriber.on("error", () => {
    // Connection errors are non-fatal; local delivery still works.
  });
  // node-redis resubscribes before it emits `ready` again, so a `ready` after a
  // drop means messages flow again - but the ones sent meanwhile are gone.
  subscriber.on("reconnecting", () => {
    if (subscribed) setPubSubState("down");
  });
  subscriber.on("end", () => {
    if (subscribed) setPubSubState("down");
  });
  subscriber.on("ready", () => {
    if (!subscribed) {
      subscribe();

      return;
    }
    if (pubSubState !== "down") return;
    setPubSubState("ready");
    resyncLocalConnections();
  });

  void subscriber
    .connect()
    .then(subscribe)
    .catch(() => {
      // The reconnect strategy keeps retrying; `ready` subscribes then.
    });
};

const service = createServiceStore();

/**
 * The Node/Bun runtime: this process's registry, delivered to directly and
 * relayed to every other instance through Redis when it is configured.
 */
export const processRealtimeRuntime: RealtimeRuntime = {
  bind: fn => fn,
  crossInstance: isRealtimePubSubEnabled,
  kind: "process",
  onInstanceMessage: listener => instanceListeners.add(listener),
  onRemoteRoomMessage: listener => roomListeners.add(listener),
  publishToInstances: (topic, data) => {
    publish({ data, id: topic, type: "instance" });
  },
  ready: waitForRealtimePubSub,
  realtime: realtimeFromCommands(command => {
    deliverToRegistry(processRegistry, command);
    publish(command);
  }),
  registry: processRegistry,
  runOnHost: async (name, payload) =>
    await runRealtimeHostCommand(processRealtimeRuntime, name, payload),
  service: (key, create) => service(processRealtimeRuntime, key, create),
};

setProcessRealtimeRuntime(() => processRealtimeRuntime);
