/**
 * Shared WebSocket types used by both the server (`@vitnode/core/ws/handle`,
 * `@vitnode/core/api/lib/websocket`) and the client (`@vitnode/core/ws/provider`,
 * `@vitnode/core/ws/use-websocket`). This module must stay free of any
 * server-only imports so it is safe to bundle on the client.
 */

/**
 * Envelope for every message exchanged over the VitNode WebSocket.
 *
 * The single `/ws` connection is multiplexed: each message carries the `id` of
 * the socket it targets (`{pluginId}_{module}_{id}`), so the server can
 * dispatch it to the right handler and the client can route it to the right
 * subscriber.
 */
export interface VitNodeWSMessage<TData = unknown> {
  data: TData;
  id: string;
}

/**
 * A typed contract for a WebSocket channel, shared between the server handler
 * and the client hook so both sides agree on the id and the message shapes.
 *
 * - `Send` - what the client sends to the server.
 * - `Receive` - what the client receives from the server.
 */
export interface VitNodeWSChannel<Send = unknown, Receive = unknown> {
  /**
   * Phantom field - never present at runtime. It only exists to carry the
   * `Send`/`Receive` types so they can be inferred from a channel value.
   */
  __types?: {
    receive: Receive;
    send: Send;
  };
  id: string;
}

/**
 * Compose the public id a client uses to target a WebSocket:
 * `{pluginId}_{module}_{id}`.
 */
export const getWebSocketId = (parts: {
  id: string;
  module: string;
  pluginId: string;
}): string => `${parts.pluginId}_${parts.module}_${parts.id}`;

/**
 * Define a typed {@link VitNodeWSChannel} that both the server and the client
 * can import as the single source of truth for a socket's id and message
 * shapes.
 *
 * @example
 * ```ts
 * export const echoChannel = createWebSocketChannel<ClientMsg, ServerMsg>({
 *   pluginId: "@vitnode/blog",
 *   module: "posts",
 *   id: "echo",
 * });
 * ```
 */
export const createWebSocketChannel = <
  Send = unknown,
  Receive = unknown,
>(parts: {
  id: string;
  module: string;
  pluginId: string;
}): VitNodeWSChannel<Send, Receive> => ({
  id: getWebSocketId(parts),
});
