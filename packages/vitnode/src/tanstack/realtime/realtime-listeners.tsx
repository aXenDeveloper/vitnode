import { NotificationListener } from "@/views/layouts/theme/notification-listener";
import { WebSocketAuthSync } from "@/views/layouts/theme/web-socket-auth-sync";

import { useSessionQuery } from "../auth/session-query";
import { NotificationStateSync } from "../notifications/state-sync";
import { socketUserIdFromSession } from "./session";

/**
 * Keeps the WebSocket connection's identity in step with the session and
 * listens for notification events. Rendered by `VitNodeRootProviders`; mount
 * it yourself only when not using those providers.
 */
export const RealtimeListeners = () => {
  const { data: session } = useSessionQuery();

  return (
    <>
      <NotificationListener />
      <NotificationStateSync />
      <WebSocketAuthSync userId={socketUserIdFromSession(session)} />
    </>
  );
};
