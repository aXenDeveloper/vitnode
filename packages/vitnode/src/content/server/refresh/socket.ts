import { z } from "zod";

import { buildWebSocket } from "@/api/lib/websocket";
import {
  CONTENT_REFRESH_ROOM_PREFIX,
  contentRefreshChannel,
} from "@/content/live/refresh";
import { onRemoteRoomMessage, wsRegistry } from "@/ws/registry";

import { onContentRefreshRootChanged } from "./publish";
import { createContentRefreshServer } from "./server";

const contentRefreshServer = createContentRefreshServer();

const threadChangedMessage = z.object({
  signal: z.object({ kind: z.literal("thread") }),
});

wsRegistry.onConnectionClose(contentRefreshServer.onConnectionClose);
onContentRefreshRootChanged(contentRefreshServer.revalidateRoom);

// A root changed on another instance: its members here are checked again too.
onRemoteRoomMessage((room, id, data) => {
  if (
    id === contentRefreshChannel.id &&
    room.startsWith(CONTENT_REFRESH_ROOM_PREFIX) &&
    threadChangedMessage.safeParse(data).success
  ) {
    contentRefreshServer.revalidateRoom(room).catch((error: unknown) => {
      // oxlint-disable-next-line no-console
      console.error("Content refresh revalidation error:", error);
    });
  }
});

export const contentRefreshWebSocket = buildWebSocket({
  description:
    "Content Engine live refresh: authorized subscriptions to AdminCP lists and public threads, answered with small change signals.",
  id: "refresh",
  onMessage: contentRefreshServer.handle,
});
