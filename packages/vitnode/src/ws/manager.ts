import type { VitNodeWSMessage } from "./types";

/**
 * Messages exchanged between tabs of the same origin over the
 * {@link BroadcastChannel}.
 */
type CrossTabMessage =
  | { payload: number; type: "ready-state" }
  | { payload: VitNodeWSMessage; type: "message" }
  | { payload: VitNodeWSMessage; type: "send" }
  | { type: "reconnect" }
  | { type: "request-state" };

const LEADER_LOCK = "vitnode-ws-leader";
const CHANNEL_NAME = "vitnode-ws";
const RECONNECT_DELAY = 2000;

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
  /**
   * Drop the shared connection and open a fresh one. The new socket
   * re-runs the handshake, so the server re-reads the session cookie - use
   * this after sign-in/sign-out so the connection's user changes.
   */
  reconnect: () => void;
  send: (message: VitNodeWSMessage) => void;
}

/**
 * Manages a single WebSocket connection shared across every tab of the same
 * origin.
 *
 * One tab is elected "leader" via the Web Locks API and owns the actual socket;
 * the other tabs are "followers". Outgoing messages from followers are relayed
 * to the leader, and every incoming server message is fanned out to all tabs
 * over a {@link BroadcastChannel}. This means data is shared across tabs with
 * exactly one connection and no duplicated messages.
 *
 * When the leader tab closes, its Web Lock is released and a follower is
 * automatically promoted, re-opening the socket.
 *
 * If the browser lacks the Web Locks API or `BroadcastChannel`, the manager
 * gracefully falls back to a per-tab connection.
 */
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
  const outgoingQueue: VitNodeWSMessage[] = [];

  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(CHANNEL_NAME);

  const post = (message: CrossTabMessage) => channel?.postMessage(message);

  const setReadyState = (state: number) => {
    readyState = state;
    onReadyStateChange(state);
  };

  const sendOverSocket = (message: VitNodeWSMessage) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      // Buffer until the leader's socket is open.
      outgoingQueue.push(message);
    }
  };

  // --- Leader: owns the real socket ---------------------------------------
  const openSocket = () => {
    const ws = new WebSocket(url);
    socket = ws;

    ws.onopen = () => {
      setReadyState(ws.readyState);
      post({ payload: ws.readyState, type: "ready-state" });
      outgoingQueue
        .splice(0)
        .forEach(message => ws.send(JSON.stringify(message)));
    };

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;

      let message: VitNodeWSMessage;
      try {
        message = JSON.parse(event.data) as VitNodeWSMessage;
      } catch {
        return;
      }

      onMessage(message); // this (leader) tab
      post({ payload: message, type: "message" }); // every other tab
    };

    ws.onclose = () => {
      setReadyState(ws.readyState);
      post({ payload: ws.readyState, type: "ready-state" });
      socket = null;
      if (!isDestroyed && isLeader) {
        reconnectTimeout = setTimeout(openSocket, RECONNECT_DELAY);
      }
    };
  };

  const becomeLeader = () => {
    if (isDestroyed) return;
    isLeader = true;
    openSocket();
  };

  // Drop the current socket (without triggering its auto-reconnect) and open a
  // fresh one immediately, so the handshake re-authenticates with the latest
  // cookies. Only the leader owns a socket.
  const reconnectLeader = () => {
    if (!isLeader || isDestroyed) return;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);

    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.onopen = null;
      socket.close();
      socket = null;
    }

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

  requestLeadership();
  // In case we joined while another tab already owns an open connection.
  post({ type: "request-state" });

  const destroy = () => {
    isDestroyed = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    socket?.close();
    socket = null;
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
