import type { Context } from "hono";
import type { WSContext } from "hono/ws";

import type { EnvVitNode } from "../middlewares/global.middleware";

export { getWebSocketId } from "@/ws/types";

/**
 * WebSocket context for controlling the connection. Use it to `send`, `close`
 * or read the `readyState`. The underlying runtime socket is exposed on
 * `ws.raw` and is left generic so the same handler works across runtimes
 * (node.js `ws`, Bun, ...).
 */
export type VitNodeWSContext = WSContext;

/**
 * Arguments passed to a registered WebSocket's `onMessage` handler.
 *
 * - `TReceive` - the payload the client sends for this socket.
 * - `TSend` - the payload the server sends back to the client.
 */
export interface VitNodeWSMessageParams<TReceive = unknown, TSend = unknown> {
  /** Hono request context - reach the db, the user, the logger, etc. */
  c: Context<EnvVitNode>;
  /** The payload sent by the client for this socket. */
  data: TReceive;
  /** Send a payload back to this client on the same socket id. */
  send: (data: TSend) => void;
  /** Low-level WebSocket context (`send`, `close`, `readyState`, ...). */
  ws: VitNodeWSContext;
}

/**
 * A registered WebSocket. The generic argument types are only used at the
 * definition site (via {@link buildWebSocket}); once stored they are erased so
 * sockets with different message shapes can live in the same array.
 */
export interface BuildWebSocketReturn {
  description?: string;
  /**
   * The part of the id chosen by the developer. The full id a client targets
   * is `{pluginId}_{module}_{id}`.
   */
  id: string;
  onMessage: (params: VitNodeWSMessageParams) => Promise<void> | void;
}

/**
 * A registered WebSocket together with the plugin and module it belongs to.
 * The `module` is filled in when the module is built and the `pluginId` when
 * the plugin is built, mirroring how cron jobs are wired up.
 */
export interface WebSocketConfig extends BuildWebSocketReturn {
  module: string;
  pluginId: string;
}

export function buildWebSocket<TReceive = unknown, TSend = unknown>(webSocket: {
  description?: string;
  id: string;
  onMessage: (
    params: VitNodeWSMessageParams<TReceive, TSend>,
  ) => Promise<void> | void;
}): BuildWebSocketReturn {
  return webSocket as BuildWebSocketReturn;
}
