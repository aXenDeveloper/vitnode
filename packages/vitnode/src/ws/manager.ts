import type { VitNodeWSMessage } from "./types";

import { WS_PING_ID, WS_PONG_ID } from "./types";

/**
 * Messages exchanged between tabs of the same origin over the
 * {@link BroadcastChannel}.
 */
type CrossTabMessage =
  | { payload: number; type: "ready-state" }
  | { payload: VitNodeWSMessage; type: "message" }
  | { payload: VitNodeWSMessage; type: "send" }
  | { type: "reconnect" }
  | { type: "request-state" }
  | { type: "wake" };

const LEADER_LOCK = "vitnode-ws-leader";
const CHANNEL_NAME = "vitnode-ws";
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30_000;
const HEARTBEAT_INTERVAL = 25_000;
const HEARTBEAT_TIMEOUT = 10_000;

const isOffline = (): boolean =>
  typeof navigator !== "undefined" &&
  "onLine" in navigator &&
  !navigator.onLine;

// Exponential backoff with "equal jitter": after a server restart every tab of
// every visitor would otherwise reconnect in the same instant, forever.
const reconnectDelay = (attempt: number): number => {
  const ceiling = Math.min(
    RECONNECT_MAX_DELAY,
    RECONNECT_BASE_DELAY * 2 ** attempt,
  );

  return ceiling / 2 + Math.random() * (ceiling / 2);
};

export interface WebSocketManagerOptions {
  /** Called once per logical server message, in every tab. */
  onMessage: (message: VitNodeWSMessage) => void;
  /** Called whenever the shared connection's `readyState` changes. */
  onReadyStateChange: (state: number) => void;
  url: string;
}

export interface WebSocketManager {
  destroy: () => void;
  getReadyState: () => number;

  reconnect: () => void;
  send: (message: VitNodeWSMessage) => void;
}

export const createWebSocketManager = ({
  url,
  onMessage,
  onReadyStateChange,
}: WebSocketManagerOptions): WebSocketManager => {
  let socket: null | WebSocket = null;
  let isLeader = false;
  let isDestroyed = false;
  let readyState = 0; // WebSocket.CONNECTING
  let releaseLeadership: (() => void) | undefined;
  let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
  let reconnectAttempt = 0;
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  let pongTimeout: ReturnType<typeof setTimeout> | undefined;
  const outgoingQueue: VitNodeWSMessage[] = [];

  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(CHANNEL_NAME);

  const post = (message: CrossTabMessage) => {
    if (isDestroyed) return;
    channel?.postMessage(message);
  };

  const setReadyState = (state: number) => {
    readyState = state;
    onReadyStateChange(state);
  };

  const publishReadyState = (state: number) => {
    setReadyState(state);
    post({ payload: state, type: "ready-state" });
  };

  const clearPongTimeout = () => {
    clearTimeout(pongTimeout);
    pongTimeout = undefined;
  };

  const stopHeartbeat = () => {
    clearInterval(heartbeatInterval);
    heartbeatInterval = undefined;
    clearPongTimeout();
  };

  const sendOverSocket = (message: VitNodeWSMessage) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      // Buffer until the leader's socket is open.
      outgoingQueue.push(message);
    }
  };

  // Detach handlers first so the socket's asynchronous close event can't fire
  // spurious reconnects or cross-tab posts after teardown.
  const closeSocket = () => {
    stopHeartbeat();
    if (!socket) return;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.onopen = null;
    socket.close();
    socket = null;
  };

  const dropSocket = () => {
    closeSocket();
    publishReadyState(WebSocket.CLOSED);
  };

  const scheduleReconnect = () => {
    if (isDestroyed || !isLeader || isOffline()) return;
    reconnectTimeout = setTimeout(
      openSocket,
      reconnectDelay(reconnectAttempt++),
    );
  };

  const probe = () => {
    if (socket?.readyState !== WebSocket.OPEN || pongTimeout) return;
    socket.send(JSON.stringify({ data: null, id: WS_PING_ID }));
    pongTimeout = setTimeout(() => {
      dropSocket();
      scheduleReconnect();
    }, HEARTBEAT_TIMEOUT);
  };

  // --- Leader: owns the real socket ---------------------------------------
  const openSocket = () => {
    const ws = new WebSocket(url);
    socket = ws;

    ws.onopen = () => {
      reconnectAttempt = 0;
      publishReadyState(ws.readyState);
      outgoingQueue
        .splice(0)
        .forEach(message => ws.send(JSON.stringify(message)));
      heartbeatInterval = setInterval(probe, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event: MessageEvent) => {
      clearPongTimeout();
      if (typeof event.data !== "string") return;

      let message: VitNodeWSMessage;
      try {
        message = JSON.parse(event.data) as VitNodeWSMessage;
      } catch {
        return;
      }
      if (message.id === WS_PONG_ID) return;

      onMessage(message); // this (leader) tab
      post({ payload: message, type: "message" }); // every other tab
    };

    ws.onclose = () => {
      stopHeartbeat();
      publishReadyState(ws.readyState);
      socket = null;
      scheduleReconnect();
    };
  };

  const becomeLeader = () => {
    if (isDestroyed) return;
    isLeader = true;
    if (isOffline()) {
      publishReadyState(WebSocket.CLOSED);

      return;
    }
    openSocket();
  };

  const wake = () => {
    if (!isLeader || isDestroyed || isOffline()) return;
    if (socket?.readyState === WebSocket.OPEN) {
      probe();

      return;
    }
    if (socket) return;
    clearTimeout(reconnectTimeout);
    reconnectAttempt = 0;
    openSocket();
  };

  const goOffline = () => {
    if (!isLeader || isDestroyed) return;
    clearTimeout(reconnectTimeout);
    dropSocket();
  };

  const requestWake = () => {
    if (isLeader) {
      wake();
    } else {
      post({ type: "wake" });
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") requestWake();
  };

  // Drop the current socket (without triggering its auto-reconnect) and open a
  // fresh one immediately, so the handshake re-authenticates with the latest
  // cookies. Only the leader owns a socket.
  const reconnectLeader = () => {
    if (!isLeader || isDestroyed) return;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    closeSocket();
    openSocket();
  };

  // --- Leadership election via Web Locks ----------------------------------
  const requestLeadership = () => {
    if (typeof navigator === "undefined" || !navigator.locks || !channel) {
      // No cross-tab primitives available: run a standalone connection.
      becomeLeader();

      return;
    }

    void navigator.locks
      .request(LEADER_LOCK, { mode: "exclusive" }, async () => {
        if (isDestroyed) return;

        const held = new Promise<void>(resolve => {
          releaseLeadership = resolve;
        });
        becomeLeader();
        await held;
      })
      .catch(() => {
        becomeLeader();
      });
  };

  // --- Cross-tab message handling (leader + followers) --------------------
  if (channel) {
    channel.onmessage = (event: MessageEvent<CrossTabMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "message":
          onMessage(message.payload);
          break;
        case "ready-state":
          if (!isLeader) setReadyState(message.payload);
          break;
        case "reconnect":
          if (isLeader) reconnectLeader();
          break;
        case "request-state":
          if (isLeader) post({ payload: readyState, type: "ready-state" });
          break;
        case "send":
          if (isLeader) sendOverSocket(message.payload);
          break;
        case "wake":
          wake();
          break;
      }
    };
  }

  const send = (message: VitNodeWSMessage) => {
    if (isLeader || !channel) {
      sendOverSocket(message);
    } else {
      // Ask the leader tab to send on our behalf.
      post({ payload: message, type: "send" });
    }
  };

  const reconnect = () => {
    if (isLeader || !channel) {
      reconnectLeader();
    } else {
      // Ask the leader tab (which owns the socket) to reconnect.
      post({ type: "reconnect" });
    }
  };

  const hasWindow = typeof window !== "undefined";
  if (hasWindow) {
    window.addEventListener("online", wake);
    window.addEventListener("offline", goOffline);
    window.addEventListener("pageshow", requestWake);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  requestLeadership();
  // In case we joined while another tab already owns an open connection.
  post({ type: "request-state" });

  const destroy = () => {
    isDestroyed = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (hasWindow) {
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("pageshow", requestWake);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    closeSocket();
    releaseLeadership?.();
    channel?.close();
  };

  return {
    destroy,
    getReadyState: () => readyState,
    reconnect,
    send,
  };
};
