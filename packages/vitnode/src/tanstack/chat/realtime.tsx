import React from "react";

import { useChatSessionUser } from "./chat-view";
import { isChatDockEnabled, isChatUiEnabled } from "./config";
import { e2eStore } from "./e2e/store";
import { ChatLiveSync } from "./live";

const ChatDock = React.lazy(async () => ({
  default: (await import("./dock")).ChatDock,
}));

/**
 * Chat's always-on parts: live updates and the dock. Mounted once by
 * `RealtimeListeners`; nothing for guests.
 */
export const ChatRealtime = () => {
  const me = useChatSessionUser();
  const previous = React.useRef<null | number>(null);
  const userId = me?.id ?? null;

  // Signing out (or in as someone else) locks encrypted chats on this device.
  React.useEffect(() => {
    const before = previous.current;
    previous.current = userId;
    if (before !== null && before !== userId) void e2eStore.lock(before);
  }, [userId]);

  if (!me || !isChatUiEnabled()) return null;

  return (
    <>
      <ChatLiveSync />
      {isChatDockEnabled() ? (
        <React.Suspense fallback={null}>
          <ChatDock me={me} />
        </React.Suspense>
      ) : null}
    </>
  );
};
