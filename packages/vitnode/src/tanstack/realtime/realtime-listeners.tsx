import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import { useUserPresenceHeartbeat } from "@/hooks/use-user-presence-heartbeat";
import { NotificationListener } from "@/views/layouts/theme/notification-listener";
import { WebSocketAuthSync } from "@/views/layouts/theme/web-socket-auth-sync";

import { invalidateSession, useSessionQuery } from "../auth/session-query";
import { NotificationStateSync } from "../notifications/state-sync";
import { socketUserIdFromSession } from "./session";

/**
 * Keeps the WebSocket connection's identity in step with the session and
 * listens for notification events. Rendered by `VitNodeRootProviders`; mount
 * it yourself only when not using those providers.
 */
export const RealtimeListeners = () => {
  const { data: session } = useSessionQuery();
  const queryClient = useQueryClient();
  const onSignedOut = React.useCallback(() => {
    void invalidateSession(queryClient);
  }, [queryClient]);

  useUserPresenceHeartbeat({
    onSignedOut,
    userId: session?.user?.id ?? null,
  });

  return (
    <>
      <NotificationListener />
      <NotificationStateSync />
      <WebSocketAuthSync userId={socketUserIdFromSession(session)} />
    </>
  );
};
