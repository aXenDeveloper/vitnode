"use client";

import React from "react";

import { CONFIG } from "@/lib/config";

import type { WebSocketManager } from "./manager";
import type { VitNodeWSMessage } from "./types";

import { createWebSocketManager } from "./manager";

type Listener = (data: unknown) => void;

interface VitNodeWebSocketContextValue {
  readyState: number;
  reconnect: () => void;
  send: (id: string, data: unknown) => void;
  subscribe: (id: string, listener: Listener) => () => void;
}

const VitNodeWebSocketContext =
  React.createContext<null | VitNodeWebSocketContextValue>(null);

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

const shouldConnectWebSocket = (): boolean =>
  CONFIG.api.pathname !== CONFIG.web.pathname ||
  CONFIG.api.port !== CONFIG.web.port;

export const VitNodeWebSocketProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const listenersRef = React.useRef<Map<string, Set<Listener>>>(new Map());
  const managerRef = React.useRef<null | WebSocketManager>(null);
  const pendingSendRef = React.useRef<VitNodeWSMessage[]>([]);
  const [readyState, setReadyState] = React.useState<number>(() => {
    if (typeof WebSocket === "undefined") return 0;

    return shouldConnectWebSocket() ? WebSocket.CONNECTING : WebSocket.CLOSED;
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
      onReadyStateChange: setReadyState,
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

  const value = React.useMemo<VitNodeWebSocketContextValue>(
    () => ({ readyState, reconnect, send, subscribe }),
    [readyState, reconnect, send, subscribe],
  );

  return (
    <VitNodeWebSocketContext.Provider value={value}>
      {children}
    </VitNodeWebSocketContext.Provider>
  );
};
