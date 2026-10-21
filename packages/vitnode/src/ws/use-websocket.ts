import React from "react";

import type { VitNodeWSChannel } from "./types";

import { useVitNodeWebSocketContext } from "./provider";

export interface UseVitNodeWebSocketReturn<Send> {
  /**
   * Changes every time the shared connection (re)opens, in every tab, and is
   * `null` while it is not open. Depend on it to restore server-side state
   * after a reconnect - rejoin rooms, resubscribe, reload what may have been
   * missed. The server keeps no state for a closed socket and replays nothing.
   */
  connectionId: null | string;
  /**
   * The current `readyState` of the shared connection (`0` CONNECTING, `1`
   * OPEN, `2` CLOSING, `3` CLOSED).
   */
  readyState: number;
  /** Send a typed payload to this socket. */
  send: (data: Send) => void;
}

/**
 * Subscribes a component to one socket on the shared connection and returns a
 * typed `send`. Browser-only; requires `<VitNodeWebSocketProvider>` higher in
 * the tree and throws without it.
 *
 * Messages sent before the connection opens are queued by the provider.
 * Delivery is best effort: a reconnect - after a network drop, a deploy, or a
 * serverless host's duration limit - loses rooms and anything pushed meanwhile,
 * so restore them when `connectionId` changes.
 *
 * @param channel A channel from `createWebSocketChannel`, or a raw socket id.
 * @param options.onMessage Called with each payload the server sends to this
 * socket. The latest function is always used, so it need not be memoized.
 *
 * @example
 * ```tsx
 * const { connectionId, send } = useVitNodeWebSocket(roomChannel, {
 *   onMessage: data => setText(data.text),
 * });
 *
 * React.useEffect(() => {
 *   if (connectionId) send({ room: "lobby", type: "join" });
 * }, [connectionId, send]);
 * ```
 */
export function useVitNodeWebSocket<Send = unknown, Receive = unknown>(
  channel: string | VitNodeWSChannel<Send, Receive>,
  options?: {
    onMessage?: (data: Receive) => void;
  },
): UseVitNodeWebSocketReturn<Send> {
  const {
    connectionId,
    readyState,
    send: contextSend,
    subscribe,
  } = useVitNodeWebSocketContext();
  const id = typeof channel === "string" ? channel : channel.id;

  // Keep the latest handler in a ref so subscribing does not depend on it.
  const onMessageRef = React.useRef(options?.onMessage);
  React.useEffect(() => {
    onMessageRef.current = options?.onMessage;
  });

  React.useEffect(
    () => subscribe(id, data => onMessageRef.current?.(data as Receive)),
    [id, subscribe],
  );

  const send = React.useCallback(
    (data: Send) => contextSend(id, data),
    [contextSend, id],
  );

  return {
    connectionId: readyState === 1 ? connectionId : null,
    readyState,
    send,
  };
}
