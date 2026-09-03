import type { WSContext } from "hono/ws";

import type { CacheClient } from "@/api/lib/cache";

import type { VitNodeWSChannel, VitNodeWSMessage } from "./types";

const connections = new Map<WSContext, null | number>();

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

const REALTIME_PUBSUB_CHANNEL = "vitnode:ws";

/**
 * Unique per process. Tagged onto every published message so the instance that
 * sent it can ignore its own echo (it already delivered to its local clients).
 */
const instanceId = crypto.randomUUID();

let publisher: CacheClient | null = null;

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

export const initRealtimePubSub = (client: CacheClient | null): void => {
  // No-op without Redis, or if already initialized.
  if (!client || publisher) return;

  publisher = client;

  // A connection in subscribe mode can't run other commands, so use a
  // dedicated duplicate for receiving. `duplicate()` returns a disconnected
  // client, hence the explicit `connect()`; node-redis restores the
  // subscription itself after every reconnect, so this only runs once.
  const subscriber = client.duplicate();
  subscriber.on("error", () => {
    // Connection errors are non-fatal; local delivery still works.
  });

  void subscriber
    .connect()
    .then(async () =>
      subscriber.subscribe(REALTIME_PUBSUB_CHANNEL, raw => {
        try {
          const message = JSON.parse(raw) as RealtimePubSubMessage;
          // Skip our own echo - the publisher already delivered locally.
          if (message.origin === instanceId) return;
          deliverLocally(message);
        } catch {
          // Ignore malformed payloads.
        }
      }),
    )
    .catch(() => {
      // Realtime stays single-instance; local clients still get their messages.
    });
};

export interface VitNodeRealtime {
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
