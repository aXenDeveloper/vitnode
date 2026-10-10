import type {
  ContentLiveRoomRef,
  ContentLiveServerMessage,
} from "@/content/live/protocol";

import { contentLiveChannel, contentLiveRoom } from "@/content/live/protocol";
import { realtime } from "@/ws/registry";

export const broadcastContentLive = (
  room: ContentLiveRoomRef,
  message: ContentLiveServerMessage,
): void => {
  realtime.toRoom(contentLiveRoom(room), contentLiveChannel, message);
};
