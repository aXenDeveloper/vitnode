import type { WSContext } from "hono/ws";

import { AsyncLocalStorage } from "node:async_hooks";

import type { CacheClient } from "@/api/lib/cache";

import type { VitNodeWSChannel, VitNodeWSMessage } from "./types";

const connections = new Map<WSContext, null | number>();
// Reverse indexes, so per-user sends and closing a socket touch only what
// belongs to that user/socket instead of scanning every connection or room.
const connectionsByUser = new Map<number, Set<WSContext>>();
const roomsBySocket = new Map<WSContext, Set<string>>();

const rooms = new Map<string, Map<WSContext, Set<string>>>();

type ConnectionCloseListener = (
  ws: WSContext,
  left: { memberId: string; room: string }[],
) => void;

const closeListeners = new Set<ConnectionCloseListener>();

let webSocketEnabled = false;

/** Called once when the app mounts the `/ws` handler. */
export const markWebSocketEnabled = (): void => {
  webSocketEnabled = true;
};

/** Whether the app mounted the WebSocket `/ws` handler. */
export const isWebSocketEnabled = (): boolean => webSocketEnabled;

const encode = (id: string, data: unknown): string =>
  JSON.stringify({ data, id } satisfies VitNodeWSMessage);

const sendRaw = (ws: WSContext, raw: string): void => {
  try {
    ws.send(raw);
  } catch (_error) {
    wsRegistry.remove(ws);
  }
};

// A failed send removes that socket mid-loop, which Map/Set iteration allows.
const sendRawToAll = (sockets: Iterable<WSContext>, raw: string): void => {
  for (const ws of sockets) sendRaw(ws, raw);
};

const unindexUser = (ws: WSContext, userId: null | number | undefined) => {
  if (userId === null || userId === undefined) return;
  const sockets = connectionsByUser.get(userId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) connectionsByUser.delete(userId);
};

/**
 * This process's open WebSocket connections and rooms. Server-only. Every
 * method acts on this instance only; for delivery across instances (via
 * Redis) use `c.get("realtime")`. A socket whose send fails is removed.
 */
export const wsRegistry = {
  /** Tracks a new connection and the signed-in user who owns it (`null` for a guest). */
  add: (ws: WSContext, userId: null | number): void => {
    unindexUser(ws, connections.get(ws));
    connections.set(ws, userId);
    if (userId === null) return;

    const sockets = connectionsByUser.get(userId) ?? new Set<WSContext>();
    connectionsByUser.set(userId, sockets);
    sockets.add(ws);
  },
  /** Send `{ id, data }` to every open connection. */
  broadcast: (id: string, data: unknown): void => {
    if (connections.size === 0) return;
    sendRawToAll(connections.keys(), encode(id, data));
  },
  /**
   * Adds `memberId` on this socket to `room`; `true` if it was not there yet.
   * Check who may join before calling it - a room is only as private as that.
   */
  join: (ws: WSContext, room: string, memberId: string): boolean => {
    const sockets = rooms.get(room) ?? new Map<WSContext, Set<string>>();
    rooms.set(room, sockets);
    const members = sockets.get(ws) ?? new Set<string>();
    sockets.set(ws, members);
    const joined = roomsBySocket.get(ws) ?? new Set<string>();
    roomsBySocket.set(ws, joined);
    joined.add(room);

    if (members.has(memberId)) return false;
    members.add(memberId);

    return true;
  },
  /** Removes `memberId` on this socket from `room`; `true` if it was there. */
  leave: (ws: WSContext, room: string, memberId: string): boolean => {
    const sockets = rooms.get(room);
    const members = sockets?.get(ws);
    if (!sockets || !members?.delete(memberId)) return false;

    if (members.size === 0) {
      sockets.delete(ws);
      const joined = roomsBySocket.get(ws);
      joined?.delete(room);
      if (joined?.size === 0) roomsBySocket.delete(ws);
    }
    if (sockets.size === 0) rooms.delete(room);

    return true;
  },
  /** Every member of `room` on this instance, with its socket. */
  membersOf: (room: string): { memberId: string; ws: WSContext }[] =>
    [...(rooms.get(room) ?? new Map<WSContext, Set<string>>())].flatMap(
      ([ws, members]) => [...members].map(memberId => ({ memberId, ws })),
    ),
  /**
   * Runs `listener` when a socket that was in a room closes, with the rooms
   * and members it left. Returns an unsubscribe function. Listener errors are
   * logged, not thrown.
   */
  onConnectionClose: (listener: ConnectionCloseListener): (() => void) => {
    closeListeners.add(listener);

    return () => {
      closeListeners.delete(listener);
    };
  },
  /** Forgets a closed connection and takes it out of every room. */
  remove: (ws: WSContext): void => {
    unindexUser(ws, connections.get(ws));
    connections.delete(ws);

    const joined = roomsBySocket.get(ws);
    roomsBySocket.delete(ws);
    if (!joined) return;

    const left: { memberId: string; room: string }[] = [];
    joined.forEach(room => {
      const sockets = rooms.get(room);
      const members = sockets?.get(ws);
      if (!sockets || !members) return;

      members.forEach(memberId => left.push({ memberId, room }));
      sockets.delete(ws);
      if (sockets.size === 0) rooms.delete(room);
    });

    if (left.length === 0) return;

    closeListeners.forEach(listener => {
      try {
        listener(ws, left);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("WebSocket close listener error:", error);
      }
    });
  },
  /**
   * Closes every connection on this instance with `code`, so each client
   * reconnects and restores its rooms and state. Cleanup runs through each
   * socket's normal close handling.
   */
  closeAll: (code: number, reason: string): void => {
    for (const ws of [...connections.keys()]) {
      try {
        ws.close(code, reason);
      } catch {
        wsRegistry.remove(ws);
      }
    }
  },
  /** The rooms one socket is in. */
  roomsOf: (ws: WSContext): string[] => [...(roomsBySocket.get(ws) ?? [])],
  /** Send `{ id, data }` to every socket in `room` on this instance. */
  toRoom: (room: string, id: string, data: unknown): void => {
    const sockets = rooms.get(room);
    if (!sockets) return;
    sendRawToAll(sockets.keys(), encode(id, data));
  },
  /** Send `{ id, data }` only to the connections owned by `userId`. */
  sendToUser: (userId: number, id: string, data: unknown): void => {
    const sockets = connectionsByUser.get(userId);
    if (!sockets) return;
    sendRawToAll(sockets, encode(id, data));
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
  room?: string;
  type: "broadcast" | "instance" | "room" | "sendToUser" | "sendToUsers";
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
  } else if (message.type === "sendToUsers" && Array.isArray(message.data)) {
    for (const entry of message.data as unknown[]) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        "userId" in entry &&
        typeof entry.userId === "number" &&
        "data" in entry
      ) {
        wsRegistry.sendToUser(entry.userId, message.id, entry.data);
      }
    }
  } else if (message.type === "room" && typeof message.room === "string") {
    wsRegistry.toRoom(message.room, message.id, message.data);
  }
};

const roomListeners = new Set<
  (room: string, id: string, data: unknown) => void
>();

export const onRemoteRoomMessage = (
  listener: (room: string, id: string, data: unknown) => void,
): (() => void) => {
  roomListeners.add(listener);

  return () => {
    roomListeners.delete(listener);
  };
};

type InstanceMessageListener = (message: {
  data: unknown;
  origin: string;
  topic: string;
}) => void;

const instanceListeners = new Set<InstanceMessageListener>();

export const onInstanceMessage = (
  listener: InstanceMessageListener,
): (() => void) => {
  instanceListeners.add(listener);

  return () => {
    instanceListeners.delete(listener);
  };
};

export const getRealtimeInstanceId = (): string => instanceId;

type KeepAlive = (task: Promise<unknown>) => void;

// The request a publish happens in, so a serverless runtime keeps the instance
// alive until Redis has the message instead of freezing it with the response.
const keepAliveScope = new AsyncLocalStorage<KeepAlive>();

/**
 * Runs `fn` with `keepAlive` receiving every realtime publish started inside
 * it, including ones from code that has no request context of its own. The
 * global middleware passes the request's `waitUntil`. Server-only.
 */
export const runWithRealtimeKeepAlive = <T>(
  keepAlive: KeepAlive,
  fn: () => T,
): T => keepAliveScope.run(keepAlive, fn);

const publish = (message: Omit<RealtimePubSubMessage, "origin">): void => {
  if (!publisher) return;

  const task = publisher
    .publish(
      REALTIME_PUBSUB_CHANNEL,
      JSON.stringify({ ...message, origin: instanceId }),
    )
    .catch(() => {
      // Other instances miss this message, but the local clients were already
      // served directly, so realtime keeps working on this instance.
    });
  keepAliveScope.getStore()?.(task);
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
  wsRegistry.closeAll(1012, "Realtime resync");
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

export const initRealtimePubSub = (client: CacheClient | null): void => {
  // No-op without Redis, or if already initialized.
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
      const message = JSON.parse(raw) as RealtimePubSubMessage;
      // Skip our own echo - the publisher already delivered locally.
      if (message.origin === instanceId) return;
      if (message.type === "instance") {
        const { data, id: topic, origin } = message;
        instanceListeners.forEach(listener => {
          listener({ data, origin, topic });
        });

        return;
      }
      if (message.type === "room" && typeof message.room === "string") {
        const { data, id, room } = message;
        roomListeners.forEach(listener => listener(room, id, data));
      }
      deliverLocally(message);
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

export const publishToInstances = (topic: string, data: unknown): void => {
  publish({ data, id: topic, type: "instance" });
};

/**
 * Server push to browsers over the shared WebSocket, available as
 * `c.get("realtime")` in API handlers.
 *
 * Delivery is best effort and fire-and-forget: clients that are not connected
 * miss the message, and nothing is replayed after a reconnect - keep durable
 * state in the database and let clients reload it when they reconnect. Without
 * Redis (`REDIS_URL`) only clients connected to the current instance receive
 * it; with Redis it is relayed to every instance, and the publish is kept
 * alive past the HTTP response with the request's `waitUntil`.
 */
export interface VitNodeRealtime {
  /** Push a payload to every open connection. */
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
  /**
   * Push a different payload to each of many users on one channel. Same as
   * calling `sendToUser` in a loop, but other instances get it as a single
   * pub/sub message instead of one per user.
   */
  sendToUsers: <Receive>(
    channel: VitNodeWSChannel<unknown, Receive>,
    messages: Iterable<{ data: Receive; userId: number }>,
  ) => void;
  /** Push a payload to the connections that joined `room`. */
  toRoom: <Receive>(
    room: string,
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
  sendToUsers: (channel, messages) => {
    const batch = [...messages];
    if (batch.length === 0) return;

    for (const { data, userId } of batch) {
      wsRegistry.sendToUser(userId, channel.id, data);
    }
    publish({ data: batch, id: channel.id, type: "sendToUsers" });
  },
  toRoom: (room, channel, data) => {
    wsRegistry.toRoom(room, channel.id, data);
    publish({ data, id: channel.id, room, type: "room" });
  },
};
