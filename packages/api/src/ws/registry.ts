import type { WSContext } from "hono/ws";

import type {
  ConnectionCloseListener,
  WebSocketRegistry,
} from "./create-registry";
import type { VitNodeRealtime } from "./realtime";
import type {
  InstanceMessageListener,
  RealtimeRuntime,
  RealtimeScope,
  RemoteRoomListener,
} from "./runtime";

import { sharedCloseListeners } from "./process-runtime";
import {
  currentRealtimeRuntime,
  currentRealtimeScope,
  RealtimeConfigurationError,
  runInRealtimeScope,
} from "./runtime";

export type {
  ConnectionCloseListener,
  WebSocketRegistry,
  WebSocketRoomLeft,
} from "./create-registry";
export { createWebSocketRegistry } from "./create-registry";
export {
  getRealtimeInstanceId,
  initRealtimePubSub,
  waitForRealtimePubSub,
} from "./process-runtime";
export type { VitNodeRealtime } from "./realtime";
export {
  currentRealtimeRuntime,
  RealtimeConfigurationError,
  runInRealtimeScope,
} from "./runtime";
export type { RealtimeRuntime, RealtimeScope } from "./runtime";

const WEB_SOCKET_ENABLED_KEY = Symbol.for("vitnode.ws.enabled");

type EnabledHolder = typeof globalThis & { [WEB_SOCKET_ENABLED_KEY]?: true };

/** Called once when the app mounts the `/ws` handler. */
export const markWebSocketEnabled = (): void => {
  (globalThis as EnabledHolder)[WEB_SOCKET_ENABLED_KEY] = true;
};

/** Whether the app mounted the WebSocket `/ws` handler. */
export const isWebSocketEnabled = (): boolean =>
  (globalThis as EnabledHolder)[WEB_SOCKET_ENABLED_KEY] === true;

const logError = (message: string, error: unknown): void => {
  // oxlint-disable-next-line no-console
  console.error(message, error);
};

/**
 * The registry of the runtime that owns the current socket event.
 *
 * @throws {RealtimeConfigurationError} Where no runtime owns sockets - an
 * HTTP request on Cloudflare, whose sockets live in the Durable Object hub.
 */
const currentRegistry = (): WebSocketRegistry => {
  const runtime = currentRealtimeRuntime();
  if (runtime.registry) return runtime.registry;

  throw new RealtimeConfigurationError(
    `[VitNode] wsRegistry is only available while handling a socket event; this ${runtime.kind} invocation owns no sockets. Push with c.get("realtime") instead.`,
  );
};

/**
 * The open WebSocket connections and rooms of the runtime handling the
 * current socket event: this Node/Bun process, or the installation's
 * Cloudflare hub. Server-only.
 *
 * Every method acts on that runtime only; to push to every client, use
 * `c.get("realtime")`. A socket whose send fails is removed. On Cloudflare it
 * works inside WebSocket handlers - which run in the hub - and throws a
 * {@link RealtimeConfigurationError} in an ordinary HTTP request, which owns
 * no sockets.
 */
export const wsRegistry: Omit<WebSocketRegistry, "onConnectionClose"> & {
  /**
   * Runs `listener` when a socket that was in a room closes, with the rooms
   * and members it left - in every runtime, including Cloudflare hubs created
   * later. Register it once, at module load. Returns an unsubscribe function.
   * Listener errors are logged, not thrown.
   */
  onConnectionClose: (listener: ConnectionCloseListener) => () => void;
} = {
  add: (ws, userId, deviceId = null) => {
    currentRegistry().add(ws, userId, deviceId);
  },
  broadcast: (id, data) => {
    currentRegistry().broadcast(id, data);
  },
  closeAll: (code, reason) => {
    currentRegistry().closeAll(code, reason);
  },
  closeUser: (userId, deviceId, code, reason) => {
    currentRegistry().closeUser(userId, deviceId, code, reason);
  },
  connectionCount: () => currentRegistry().connectionCount(),
  join: (ws, room, memberId) => currentRegistry().join(ws, room, memberId),
  leave: (ws, room, memberId) => currentRegistry().leave(ws, room, memberId),
  membersOf: room => currentRegistry().membersOf(room),
  onConnectionClose: listener => {
    sharedCloseListeners.add(listener);

    return () => {
      sharedCloseListeners.delete(listener);
    };
  },
  remove: (ws: WSContext) => {
    currentRegistry().remove(ws);
  },
  roomsOf: ws => currentRegistry().roomsOf(ws),
  sendToUser: (userId, id, data) => {
    currentRegistry().sendToUser(userId, id, data);
  },
  toRoom: (room, id, data) => {
    currentRegistry().toRoom(room, id, data);
  },
};

/**
 * Runs `deliver` on the current runtime's delivery. Realtime is best effort,
 * so a configuration error is logged with its fix instead of failing the
 * request that pushed.
 */
const withRealtime = (deliver: (realtime: VitNodeRealtime) => void): void => {
  let runtime: RealtimeRuntime;
  try {
    runtime = currentRealtimeRuntime();
  } catch (error) {
    logError("[VitNode] Realtime message was not sent:", error);

    return;
  }
  deliver(runtime.realtime);
};

/**
 * Pushes through the runtime the current code belongs to: the same object as
 * `c.get("realtime")` in a request, and the right one in modules that have no
 * Hono context. On Node/Bun outside a request it is the process runtime; on
 * Cloudflare it must run inside a request, socket event or
 * `runWithVitNodeCloudflare(...)` scope, and logs a configuration error
 * otherwise. Server-only. See {@link VitNodeRealtime}.
 */
export const realtime: VitNodeRealtime = {
  broadcast: (channel, data) => {
    withRealtime(target => {
      target.broadcast(channel, data);
    });
  },
  closeUserConnections: (userId, deviceId = null) => {
    withRealtime(target => {
      target.closeUserConnections(userId, deviceId);
    });
  },
  sendToUser: (userId, channel, data) => {
    withRealtime(target => {
      target.sendToUser(userId, channel, data);
    });
  },
  sendToUsers: (channel, messages) => {
    withRealtime(target => {
      target.sendToUsers(channel, messages);
    });
  },
  toRoom: (room, channel, data) => {
    withRealtime(target => {
      target.toRoom(room, channel, data);
    });
  },
};

/**
 * Whether pushes reach sockets beyond the current runtime: Redis pub/sub on
 * Node/Bun, always on Cloudflare (one hub owns every socket).
 */
export const isRealtimePubSubEnabled = (): boolean => {
  try {
    return currentRealtimeRuntime().crossInstance();
  } catch {
    return false;
  }
};

/** Sends `data` to every other instance of the current runtime. */
export const publishToInstances = (topic: string, data: unknown): void => {
  withRealtime(() => {
    currentRealtimeRuntime().publishToInstances(topic, data);
  });
};

/**
 * Subscribes to room messages that reached the process runtime from another
 * instance. Kept for compatibility; runtime-owned state subscribes with
 * `runtime.onRemoteRoomMessage` instead.
 */
export const onRemoteRoomMessage = (
  listener: RemoteRoomListener,
): (() => void) => currentRealtimeRuntime().onRemoteRoomMessage(listener);

/** Subscribes to `publishToInstances` messages of the process runtime. */
export const onInstanceMessage = (
  listener: InstanceMessageListener,
): (() => void) => currentRealtimeRuntime().onInstanceMessage(listener);

/**
 * Runs `fn` with `keepAlive` receiving every realtime message started inside
 * it that leaves the process, including ones from code that has no request
 * context of its own. The global middleware passes the request's `waitUntil`.
 * Keeps the runtime of the enclosing scope. Server-only.
 */
export const runWithRealtimeKeepAlive = <T>(
  keepAlive: (task: Promise<unknown>) => void,
  fn: () => T,
): T => {
  const scope: RealtimeScope | undefined = currentRealtimeScope();
  let runtime: RealtimeRuntime;
  try {
    runtime = scope?.runtime ?? currentRealtimeRuntime();
  } catch (error) {
    // The request itself still works; each push logs the same error.
    logError("[VitNode] Realtime is not available for this request:", error);

    return fn();
  }

  const outer = scope?.keepAlive;

  return runInRealtimeScope(
    {
      ...scope,
      // Both: the request's own `waitUntil` may be missing where the outer
      // scope (a Cloudflare invocation) has one.
      keepAlive: outer
        ? task => {
            keepAlive(task);
            outer(task);
          }
        : keepAlive,
      runtime,
    },
    fn,
  );
};
