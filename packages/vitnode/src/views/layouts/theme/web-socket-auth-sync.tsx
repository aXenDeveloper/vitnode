"use client";

// The user id comes from the server render, so the reconnect must be driven by
// the prop changing (sign-in/sign-out) rather than a client event handler.
/* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
import React from "react";

import { useVitNodeWebSocketContext } from "@/ws/provider";

/**
 * Reconnects the shared WebSocket whenever the signed-in user changes, so the
 * long-lived connection re-authenticates from the current session cookie -
 * e.g. it drops to "guest" right after sign-out (and picks up the user again
 * after sign-in). Renders nothing.
 */
export const WebSocketAuthSync = ({ userId }: { userId: null | number }) => {
  const { reconnect } = useVitNodeWebSocketContext();
  const previousUserIdRef = React.useRef(userId);

  React.useEffect(() => {
    if (previousUserIdRef.current === userId) return;

    previousUserIdRef.current = userId;
    reconnect();
  }, [userId, reconnect]);

  return null;
};
