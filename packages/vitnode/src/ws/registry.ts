import type { WSContext } from "hono/ws";
import type { Redis } from "ioredis";

import type { VitNodeWSChannel, VitNodeWSMessage } from "./types";

/**
 * In-memory registry of the WebSocket connections open on the current server
 * process, used to push messages to clients. Each connection is tagged with the
 * id of the authenticated user it belongs to (or `null` when anonymous), so a
 * payload can be delivered to a single user across all of their browsers.
 *
 * This map is per-process. When several instances run behind a load balancer,
 * {@link initRealtimePubSub} bridges them with Redis pub/sub so `broadcast` and
 * `sendToUser` also reach clients connected to the other instances.
 */
const connections = new Map<WSContext, null | number>();

/**
 * Flipped to `true` the first time the app mounts the WebSocket handler (see
 * {@link markWebSocketEnabled}). WebSockets are wired up outside `VitNodeAPI`
 * (the app calls `upgradeWebSocket(handleVitNodeWebSocket())`), so this is the
 * only reliable signal of whether the `/ws` endpoint exists in a given
 * deployment. Read by the admin integrations panel.
 */
let webSocketEnabled = false;

/** Called once when the app mounts the `/ws` handler. */
export const markWebSocketEnabled = (): void => {
  webSocketEnabled = true;
};

/** Whether the app mounted the WebSocket `/ws` handler. */
export const isWebSocketEnabled = (): boolean => webSocketEnabled;

const sendTo = (ws: WSContext, id: string, data: unknown): void => {
  try {
    ws.send(JSON.stringify({ data, id } satisfies VitNodeWSMessage));
  } catch (_error) {
    wsRegistry.remove(ws);
  }
};

export const wsRegistry = {
  add: (ws: WSContext, userId: null | number): void => {
    connections.set(ws, userId);
  },
  /** Send `{ id, data }` to every open connection. */
  broadcast: (id: string, data: unknown): void => {
    connections.forEach((_userId, ws) => sendTo(ws, id, data));
  },
  remove: (ws: WSContext): void => {
    connections.delete(ws);
  },
  /** Send `{ id, data }` only to the connections owned by `userId`. */
  sendToUser: (userId: number, id: string, data: unknown): void => {
    connections.forEach((connectionUserId, ws) => {
      if (connectionUserId === userId) sendTo(ws, id, data);
    });
  },
};

/**
 * Redis pub/sub channel every instance publishes realtime messages to and
 * subscribes for, so a `broadcast`/`sendToUser` reaches clients connected to
 * other instances behind a load balancer.
 */
const REALTIME_PUBSUB_CHANNEL = "vitnode:ws";

/**
 * Unique per process. Tagged onto every published message so the instance that
 * sent it can ignore its own echo (it already delivered to its local clients).
 */
const instanceId = crypto.randomUUID();

let publisher: null | Redis = null;

/**
 * Whether the Redis pub/sub bridge for cross-instance realtime is active. When
 * `false`, `broadcast`/`sendToUser` only reach clients on the current instance.
 */
export const isRealtimePubSubEnabled = (): boolean => publisher !== null;

interface RealtimePubSubMessage {
  data: unknown;
  id: string;
  origin: string;
  type: "broadcast" | "sendToUser";
  userId?: number;
}

const deliverLocally = (message: RealtimePubSubMessage): void => {
  if (message.type === "broadcast") {
    wsRegistry.broadcast(message.id, message.data);
  } else if (
    message.type === "sendToUser" &&
    typeof message.userId === "number"
  ) {
    wsRegistry.sendToUser(message.userId, message.id, message.data);
  }
};

const publish = (message: Omit<RealtimePubSubMessage, "origin">): void => {
  if (!publisher) return;

  void publisher
    .publish(
      REALTIME_PUBSUB_CHANNEL,
      JSON.stringify({ ...message, origin: instanceId }),
    )
    .catch(() => {
      // Other instances miss this message, but the local clients were already
      // served directly, so realtime keeps working on this instance.
    });
};

/**
 * Enable cross-instance realtime delivery using Redis pub/sub. Call once at
 * boot with the shared cache client (see `VitNodeAPI`). Passing `null` (Redis
 * not configured) keeps realtime in single-process mode — messages then only
 * reach clients connected to the current instance.
 */
export const initRealtimePubSub = (client: null | Redis): void => {
  // No-op without Redis, or if already initialized.
  if (!client || publisher) return;

  publisher = client;

  // A connection in subscribe mode can't run other commands, so use a
  // dedicated duplicate for receiving. Subscribing on "ready" (re)subscribes on
  // the first connect and after every reconnect.
  const subscriber = client.duplicate();
  subscriber.on("error", () => {
    // Connection errors are non-fatal; local delivery still works.
  });
  subscriber.on("ready", () => {
    void subscriber.subscribe(REALTIME_PUBSUB_CHANNEL).catch(() => {
      // Will retry on the next reconnect.
    });
  });
  subscriber.on("message", (channel, raw) => {
    if (channel !== REALTIME_PUBSUB_CHANNEL) return;

    try {
      const message = JSON.parse(raw) as RealtimePubSubMessage;
      // Skip our own echo — the publishing instance already delivered locally.
      if (message.origin === instanceId) return;
      deliverLocally(message);
    } catch {
      // Ignore malformed payloads.
    }
  });
};

export interface VitNodeRealtime {
  /**
   * Push a payload to **every** client subscribed to `channel`. Delivered to
   * the matching {@link useVitNodeWebSocket} subscribers (only views currently
   * on screen react). Use for non-sensitive "data changed" signals.
   */
  broadcast: <Receive>(
    channel: VitNodeWSChannel<unknown, Receive>,
    data: Receive,
  ) => void;
  /**
   * Push a payload only to the connections of a single user, across all of
   * their browsers/devices. Use for per-user data such as notifications.
   */
  sendToUser: <Receive>(
    userId: number,
    channel: VitNodeWSChannel<unknown, Receive>,
    data: Receive,
  ) => void;
}

/**
 * The realtime helper exposed on the request context as `c.get("realtime")`.
 *
 * Each call delivers to this instance's clients immediately, then (when Redis
 * pub/sub is enabled via {@link initRealtimePubSub}) fans the message out to the
 * other instances so their clients receive it too.
 */
export const realtime: VitNodeRealtime = {
  broadcast: (channel, data) => {
    wsRegistry.broadcast(channel.id, data);
    publish({ data, id: channel.id, type: "broadcast" });
  },
  sendToUser: (userId, channel, data) => {
    wsRegistry.sendToUser(userId, channel.id, data);
    publish({ data, id: channel.id, type: "sendToUser", userId });
  },
};
