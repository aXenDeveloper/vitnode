import React from "react";

import { CONFIG } from "@/lib/config";

import type { WebSocketManager } from "./manager";
import type { VitNodeWSMessage } from "./types";

import { createWebSocketManager } from "./manager";

type Listener = (data: unknown) => void;

interface VitNodeWebSocketContextValue {
  connectionId: null | string;
  readyState: number;
  reconnect: () => void;
  send: (id: string, data: unknown) => void;
  subscribe: (id: string, listener: Listener) => () => void;
}

const VitNodeWebSocketContext =
  React.createContext<null | VitNodeWebSocketContextValue>(null);

/**
 * The shared connection, or `null` outside `<VitNodeWebSocketProvider>` - for
 * features that should simply stay offline without one.
 */
export const useOptionalVitNodeWebSocketContext =
  (): null | VitNodeWebSocketContextValue => React.use(VitNodeWebSocketContext);

export const useVitNodeWebSocketContext = (): VitNodeWebSocketContextValue => {
  const context = React.use(VitNodeWebSocketContext);
  if (!context) {
    throw new Error(
      "useVitNodeWebSocket must be used within a <VitNodeWebSocketProvider>.",
    );
  }

  return context;
};

const getWebSocketUrl = (): string => {
  const url = new URL("/api/ws", CONFIG.api);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.toString();
};

// A separate API always serves `/api/ws`; an app that embeds the API serves it
// only when its Vite config enables `webSocket` (and mounts the Nitro route).
const shouldConnectWebSocket = (): boolean =>
  process.env.VITNODE_EMBEDDED_WEBSOCKET === "true" ||
  CONFIG.api.pathname !== CONFIG.web.pathname ||
  CONFIG.api.port !== CONFIG.web.port;

/**
 * Owns the browser's single WebSocket connection to `/api/ws` for
 * `useVitNodeWebSocket` hooks below it. Tabs share one socket
 * (one tab holds it and relays for the others) and it reconnects after a drop,
 * with backoff and jitter - expected on serverless hosts, which close sockets
 * at the function's maximum duration.
 *
 * In an app that embeds the API it connects only when `vitnode({ webSocket:
 * true })` is set in `vite.config.ts`; with a separate API it always does.
 */
export const VitNodeWebSocketProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const listenersRef = React.useRef<Map<string, Set<Listener>>>(new Map());
  const managerRef = React.useRef<null | WebSocketManager>(null);
  const pendingSendRef = React.useRef<VitNodeWSMessage[]>([]);
  const [connection, setConnection] = React.useState<{
    connectionId: null | string;
    readyState: number;
  }>(() => {
    if (typeof WebSocket === "undefined") {
      return { connectionId: null, readyState: 0 };
    }

    return {
      connectionId: null,
      readyState: shouldConnectWebSocket()
        ? WebSocket.CONNECTING
        : WebSocket.CLOSED,
    };
  });

  const dispatch = React.useCallback((message: VitNodeWSMessage) => {
    listenersRef.current
      .get(message.id)
      ?.forEach(listener => listener(message.data));
  }, []);

  React.useEffect(() => {
    if (!shouldConnectWebSocket()) return;

    const manager = createWebSocketManager({
      url: getWebSocketUrl(),
      onMessage: dispatch,
      onReadyStateChange: (readyState, connectionId) => {
        React.startTransition(() => {
          setConnection({ connectionId, readyState });
        });
      },
    });
    managerRef.current = manager;
    pendingSendRef.current.splice(0).forEach(message => manager.send(message));

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, [dispatch]);

  const subscribe = React.useCallback((id: string, listener: Listener) => {
    const listeners = listenersRef.current.get(id) ?? new Set<Listener>();
    listeners.add(listener);
    listenersRef.current.set(id, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        listenersRef.current.delete(id);
      }
    };
  }, []);

  const send = React.useCallback((id: string, data: unknown) => {
    const message: VitNodeWSMessage = { data, id };
    const manager = managerRef.current;

    if (manager) {
      manager.send(message);
    } else {
      pendingSendRef.current.push(message);
    }
  }, []);

  const reconnect = React.useCallback(() => {
    managerRef.current?.reconnect();
  }, []);

  const { connectionId, readyState } = connection;
  const value = React.useMemo<VitNodeWebSocketContextValue>(
    () => ({ connectionId, readyState, reconnect, send, subscribe }),
    [connectionId, readyState, reconnect, send, subscribe],
  );

  return (
    <VitNodeWebSocketContext.Provider value={value}>
      {children}
    </VitNodeWebSocketContext.Provider>
  );
};
