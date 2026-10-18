import type { Context } from "hono";
import type { WSContext } from "hono/ws";

import type { EnvVitNode } from "../middlewares/global.middleware";

export { getWebSocketId } from "@/ws/types";

export type VitNodeWSContext = WSContext;

/** What a WebSocket handler's `onMessage` receives for each matching client message. */
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

/** A WebSocket handler, as returned by {@link buildWebSocket}. */
export interface BuildWebSocketReturn {
  description?: string;
  /**
   * The part of the id chosen by the developer. The full id a client targets
   * is `{pluginId}_{module}_{id}`.
   */
  id: string;
  /**
   * Called for every client message whose `id` matches this socket. Errors,
   * sync or async, are logged to the console and never close the connection.
   */
  onMessage: (params: VitNodeWSMessageParams) => Promise<void> | void;
}

/** A WebSocket handler after registration, tagged with the module and plugin that declared it. */
export interface WebSocketConfig extends BuildWebSocketReturn {
  module: string;
  pluginId: string;
}

/**
 * Declares a server handler for messages sent over the shared `/api/ws`
 * connection. Add it to a top-level module's `webSockets` array.
 *
 * Clients address it as `{pluginId}_{module}_{id}`; share that id and the
 * message types with the browser through `createWebSocketChannel` from
 * `@vitnode/core/ws/types`, and talk to it with `useVitNodeWebSocket`. To push
 * without a client message, use `c.get("realtime")`.
 *
 * Only active when the app mounts the WebSocket endpoint
 * (`handleVitNodeWebSocket`).
 *
 * @example
 * ```ts
 * import { buildWebSocket } from "@vitnode/core/api/lib/websocket";
 *
 * export const echoSocket = buildWebSocket<{ text: string }, { text: string }>({
 *   id: "echo",
 *   onMessage: ({ data, send }) => {
 *     send({ text: data.text });
 *   },
 * });
 * ```
 */
export function buildWebSocket<TReceive = unknown, TSend = unknown>(webSocket: {
  description?: string;
  id: string;
  onMessage: (
    params: VitNodeWSMessageParams<TReceive, TSend>,
  ) => Promise<void> | void;
}): BuildWebSocketReturn {
  return webSocket as BuildWebSocketReturn;
}
