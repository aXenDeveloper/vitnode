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

/**
 * Keeps the shared WebSocket authenticated as the visitor the app currently
 * believes in.
 *
 * Renders nothing and holds no state of its own: it is a client effect driven by
 * one input. Which is what makes it framework-neutral - the app decides where
 * `userId` comes from (`getSessionApi()` in Next.js, the canonical session query
 * in TanStack Start) and this only reacts to it changing.
 *
 * `undefined` means the session is not known yet, and is the normal first value
 * on a framework that reads it in the browser. It is deliberately not the same
 * as `null`; see {@link shouldReconnectForUser}, which owns that distinction.
 */
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
