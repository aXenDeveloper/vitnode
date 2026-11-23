import React from "react";

import { useChatSessionUser } from "./chat-view";
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
  if (!me) return null;

  return (
    <>
      <ChatLiveSync />
      <React.Suspense fallback={null}>
        <ChatDock me={me} />
      </React.Suspense>
    </>
  );
};
