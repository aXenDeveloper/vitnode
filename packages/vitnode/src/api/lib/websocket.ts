import type { Context } from "hono";
import type { WSContext } from "hono/ws";

import type { EnvVitNode } from "../middlewares/global.middleware";

export { getWebSocketId } from "@/ws/types";

export type VitNodeWSContext = WSContext;

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

export interface BuildWebSocketReturn {
  description?: string;
  /**
   * The part of the id chosen by the developer. The full id a client targets
   * is `{pluginId}_{module}_{id}`.
   */
  id: string;
  onMessage: (params: VitNodeWSMessageParams) => Promise<void> | void;
}

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
