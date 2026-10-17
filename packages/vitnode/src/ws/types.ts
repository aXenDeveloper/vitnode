/** The JSON frame exchanged in both directions over the shared connection. */
export interface VitNodeWSMessage<TData = unknown> {
  data: TData;
  id: string;
}

/**
 * A socket's public id plus its message types: `Send` is what the browser
 * sends, `Receive` what the server pushes. Create one with
 * {@link createWebSocketChannel}.
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
