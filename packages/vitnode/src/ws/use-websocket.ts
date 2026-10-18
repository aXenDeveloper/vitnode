import React from "react";

import type { VitNodeWSChannel } from "./types";

import { useVitNodeWebSocketContext } from "./provider";

export interface UseVitNodeWebSocketReturn<Send> {
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
 *
 * @param channel A channel from `createWebSocketChannel`, or a raw socket id.
 * @param options.onMessage Called with each payload the server sends to this
 * socket. The latest function is always used, so it need not be memoized.
 *
 * @example
 * ```tsx
 * const { send } = useVitNodeWebSocket(echoChannel, {
 *   onMessage: data => setText(data.text),
 * });
 * ```
 */
export function useVitNodeWebSocket<Send = unknown, Receive = unknown>(
  channel: string | VitNodeWSChannel<Send, Receive>,
  options?: {
    onMessage?: (data: Receive) => void;
  },
): UseVitNodeWebSocketReturn<Send> {
  const {
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

  return { readyState, send };
}
