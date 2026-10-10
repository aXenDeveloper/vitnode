import { buildWebSocket } from "@/api/lib/websocket";
import {
  onInstanceMessage,
  onRemoteRoomMessage,
  wsRegistry,
} from "@/ws/registry";

import { onContentLiveReset } from "./hooks";
import { createContentLiveServer } from "./server";

const contentLiveServer = createContentLiveServer();

wsRegistry.onConnectionClose(contentLiveServer.onConnectionClose);
onRemoteRoomMessage(contentLiveServer.onRemoteRoomMessage);
onInstanceMessage(contentLiveServer.onInstanceMessage);
onContentLiveReset(contentLiveServer.onReset);

export const contentLiveWebSocket = buildWebSocket({
  description:
    "Content Engine live editing: presence and collaborative rich text documents.",
  id: "live",
  onMessage: async ({ c, data, ws }) => {
    await contentLiveServer.handle({ c, data, ws });
  },
});
