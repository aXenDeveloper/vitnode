import { buildWebSocket } from "@/api/lib/websocket";
import {
  onInstanceMessage,
  onRemoteRoomMessage,
  wsRegistry,
} from "@/ws/registry";

import { onContentLiveReset } from "./hooks";
import { createContentLiveServer } from "./server";

/** The live editing server of this process. */
export const contentLiveServer = createContentLiveServer();

wsRegistry.onConnectionClose(contentLiveServer.onConnectionClose);
onRemoteRoomMessage(contentLiveServer.onRemoteRoomMessage);
onInstanceMessage(contentLiveServer.onInstanceMessage);
onContentLiveReset(contentLiveServer.onReset);

/**
 * Registered on core's `content` module with the id `live`, so its public id is
 * `contentLiveChannel.id` (`@vitnode/core_content_live`).
 */
export const contentLiveWebSocket = buildWebSocket({
  description:
    "Content Engine live editing: presence and collaborative rich text documents.",
  id: "live",
  onMessage: async ({ c, data, ws }) => {
    await contentLiveServer.handle({ c, data, ws });
  },
});
