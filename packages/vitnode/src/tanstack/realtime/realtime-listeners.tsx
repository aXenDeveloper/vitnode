"use client";

import { useQuery } from "@tanstack/react-query";

import { NotificationListener } from "@/views/layouts/theme/notification-listener";
import { WebSocketAuthSync } from "@/views/layouts/theme/web-socket-auth-sync";

import { sessionQueryOptions } from "../auth/session-query";
import { socketUserIdFromSession } from "./session";

export const RealtimeListeners = () => {
  const { data: session } = useQuery(sessionQueryOptions());

  return (
    <>
      <NotificationListener />
      <WebSocketAuthSync userId={socketUserIdFromSession(session)} />
    </>
  );
};
