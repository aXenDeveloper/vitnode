import type {
  ContentLiveRoomRef,
  ContentLiveServerMessage,
} from "@/content/live/protocol";

import { contentLiveChannel, contentLiveRoom } from "@/content/live/protocol";
import { realtime } from "@/ws/registry";

/**
 * Push a live message to everyone in one record's room, on every instance. A
 * no-op for a room nobody joined, and for an app without a socket.
 */
export const broadcastContentLive = (
  room: ContentLiveRoomRef,
  message: ContentLiveServerMessage,
): void => {
  realtime.toRoom(contentLiveRoom(room), contentLiveChannel, message);
};
