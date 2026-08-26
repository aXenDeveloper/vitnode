"use client";

// The user id comes from the server render, so the reconnect must be driven by
// the prop changing (sign-in/sign-out) rather than a client event handler.
/* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
import React from "react";

import { useVitNodeWebSocketContext } from "@/ws/provider";

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
