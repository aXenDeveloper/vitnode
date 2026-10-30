import React from "react";

import type {
  ContentRefreshClientMessage,
  ContentRefreshScope,
  ContentRefreshServerMessage,
  ContentRefreshSignal,
} from "@/content/live/refresh";

import {
  contentRefreshChannel,
  contentRefreshRoom,
} from "@/content/live/refresh";
import { useOptionalVitNodeWebSocketContext } from "@/ws/provider";

/**
 * Where one live refresh subscription stands:
 *
 * - `off`: no scope, or no open connection - nothing arrives live.
 * - `joining`: the join was sent and waits for the server's answer.
 * - `live`: joined; signals arrive.
 * - `denied`: the server refused or revoked it. The data on screen needs a
 *   fresh read to find out what the viewer may still see.
 */
export type ContentLiveRefreshStatus = "denied" | "joining" | "live" | "off";

export interface ContentLiveRefreshHandlers {
  /**
   * The server refused the join, or revoked it later - signed out, a lost
   * permission or a root that is no longer readable. Read the data again
   * and drop whatever that read refuses.
   */
  onDenied?: (code: "FORBIDDEN" | "NOT_FOUND") => void;
  /** One change signal for this subscription's scope. */
  onSignal: (signal: ContentRefreshSignal) => void;
  /**
   * The server acknowledged the join. Nothing is replayed, so read the data
   * again here to cover what changed before the join - `reconnect` is `true`
   * when this subscription was live before on an earlier connection.
   */
  onSubscribed?: (info: { reconnect: boolean }) => void;
}

const newClientId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const RETRY_DELAYS_MS = [2_000, 10_000, 30_000];

/**
 * Follows one Content Engine live refresh scope - an AdminCP list or a public
 * thread - over the shared WebSocket, for as long as the component is
 * mounted with that scope. Joins when the connection opens and again after
 * every reconnect, leaves on unmount or when the scope changes, and passes on
 * only the signals of its own acknowledged join: tabs share one connection,
 * and every tab sees every message, so a tab never acts on a room another
 * tab joined. Pass `null` to stay off. Browser-only; stays `off` outside
 * `<VitNodeWebSocketProvider>` or when the app serves no WebSocket.
 *
 * Signals are hints, not data: re-read through HTTP, which stays the source
 * of truth for content and permissions. Delivery is best effort; reconcile in
 * `onSubscribed`.
 *
 * @example
 * ```tsx
 * import { useContentLiveRefresh } from "@vitnode/core/tanstack/content";
 *
 * useContentLiveRefresh(
 *   { contentTypeId: "blog.post", kind: "admin" },
 *   {
 *     onSignal: () => void refetch(),
 *     onSubscribed: () => void refetch(),
 *   },
 * );
 * ```
 */
export const useContentLiveRefresh = (
  scope: ContentRefreshScope | null,
  handlers: ContentLiveRefreshHandlers,
): ContentLiveRefreshStatus => {
  const [clientId] = React.useState(newClientId);
  const room = scope ? contentRefreshRoom(scope) : null;
  // The answer to the latest join, for the connection it was sent on.
  const [status, setStatus] = React.useState<{
    connectionId: null | string;
    room: null | string;
    status: ContentLiveRefreshStatus;
  }>({ connectionId: null, room: null, status: "off" });

  // Mutated only by the socket's message handler and the join effect.
  const joinRef = React.useRef<{
    attempt: number;
    joined: boolean;
    room: null | string;
    wasLive: boolean;
  }>({ attempt: 0, joined: false, room: null, wasLive: false });
  const retryRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const socket = useOptionalVitNodeWebSocketContext();
  const connectionId =
    socket?.readyState === 1 ? (socket.connectionId ?? null) : null;
  const socketSend = socket?.send;
  const subscribe = socket?.subscribe;
  const send = React.useCallback(
    (data: ContentRefreshClientMessage) => {
      socketSend?.(contentRefreshChannel.id, data);
    },
    [socketSend],
  );

  const onMessage = (message: ContentRefreshServerMessage) => {
    const join = joinRef.current;
    if (join.room === null || message.room !== join.room) {
      // Errors about a malformed message carry no room.
      if (
        message.type === "error" &&
        message.clientId === clientId &&
        message.room === undefined
      ) {
        setStatus({ connectionId, room: join.room, status: "denied" });
      }

      return;
    }

    switch (message.type) {
      case "changed":
        if (join.joined) handlers.onSignal(message.signal);

        return;
      case "error": {
        if (message.clientId !== clientId) return;
        join.joined = false;
        if (
          message.code === "RATE_LIMITED" ||
          message.code === "TOO_MANY_SUBSCRIPTIONS"
        ) {
          const delay = RETRY_DELAYS_MS[join.attempt];
          setStatus({ connectionId, room: join.room, status: "off" });
          if (delay === undefined || !scope) return;
          join.attempt++;
          clearTimeout(retryRef.current);
          retryRef.current = setTimeout(() => {
            if (joinRef.current.room !== room) return;
            send({ clientId, scope, type: "join" });
          }, delay);

          return;
        }
        setStatus({ connectionId, room: join.room, status: "denied" });
        if (message.code === "FORBIDDEN" || message.code === "NOT_FOUND") {
          handlers.onDenied?.(message.code);
        }

        return;
      }
      case "joined": {
        if (message.clientId !== clientId) return;
        const reconnect = join.wasLive;
        join.joined = true;
        join.wasLive = true;
        join.attempt = 0;
        setStatus({ connectionId, room: join.room, status: "live" });
        handlers.onSubscribed?.({ reconnect });

        return;
      }
      case "revoked":
        if (message.clientId !== clientId) return;
        join.joined = false;
        setStatus({ connectionId, room: join.room, status: "denied" });
        handlers.onDenied?.(message.code);
    }
  };
  const scopeRef = React.useRef(scope);
  const onMessageRef = React.useRef(onMessage);
  React.useEffect(() => {
    scopeRef.current = scope;
    onMessageRef.current = onMessage;
  });

  React.useEffect(
    () =>
      subscribe?.(contentRefreshChannel.id, data => {
        onMessageRef.current(data as ContentRefreshServerMessage);
      }),
    [subscribe],
  );

  // Joining is a message to the server: it follows the connection and the
  // scope, and leaves when either goes.
  React.useEffect(() => {
    const current = scopeRef.current;
    if (!connectionId || room === null || !current) return;

    const join = joinRef.current;
    if (join.room !== room) {
      joinRef.current = {
        attempt: 0,
        joined: false,
        room,
        wasLive: false,
      };
    } else {
      join.joined = false;
      join.attempt = 0;
    }
    send({ clientId, scope: current, type: "join" });

    return () => {
      clearTimeout(retryRef.current);
      joinRef.current.joined = false;
      send({ clientId, scope: current, type: "leave" });
    };
  }, [clientId, connectionId, room, send]);

  if (!connectionId || room === null) return "off";
  if (status.room !== room || status.connectionId !== connectionId) {
    return "joining";
  }

  return status.status;
};
