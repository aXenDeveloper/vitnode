"use client";

// The user id comes from whatever the app resolved the session to - a server
// render in Next.js, the canonical session query in TanStack Start - so the
// reconnect must be driven by the prop changing (sign-in/sign-out) rather than
// by a client event handler.
/* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
import React from "react";

import type { VitNodeSocketUserId } from "@/ws/auth-sync";

import { shouldReconnectForUser } from "@/ws/auth-sync";
import { useVitNodeWebSocketContext } from "@/ws/provider";

export const WebSocketAuthSync = ({
  userId,
}: {
  userId: undefined | VitNodeSocketUserId;
}) => {
  const { reconnect } = useVitNodeWebSocketContext();
  const previousUserIdRef = React.useRef(userId);

  React.useEffect(() => {
    const shouldReconnect = shouldReconnectForUser(
      previousUserIdRef.current,
      userId,
    );

    // Only a *known* identity advances the ref, so a session that becomes
    // unknown again does not erase the one the socket is carrying.
    if (userId !== undefined) previousUserIdRef.current = userId;
    if (shouldReconnect) reconnect();
  }, [userId, reconnect]);

  return null;
};
