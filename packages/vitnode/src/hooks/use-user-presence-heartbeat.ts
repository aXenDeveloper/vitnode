import React from "react";

import {
  presenceHeartbeatStorageKey,
  type SendPresenceHeartbeat,
  startPresenceHeartbeat,
} from "@/views/presence/presence-heartbeat";

/**
 * Keeps the signed-in member online while one of their tabs is visible. Pass
 * `null` when nobody is signed in - and after sign-out - to stop it.
 */
export const useUserPresenceHeartbeat = ({
  onSignedOut,
  send,
  userId,
}: {
  onSignedOut?: () => void;
  send?: SendPresenceHeartbeat;
  userId: null | number;
}): void => {
  const onSignedOutRef = React.useRef(onSignedOut);

  React.useEffect(() => {
    onSignedOutRef.current = onSignedOut;
  }, [onSignedOut]);

  React.useEffect(() => {
    if (userId === null) return;

    return startPresenceHeartbeat({
      onSignedOut: () => onSignedOutRef.current?.(),
      send,
      storageKey: presenceHeartbeatStorageKey(userId),
    });
  }, [send, userId]);
};
