import { createWebSocketChannel } from "@/ws/types";

import type { ChatMessage, ChatReactionSummary } from "../types";

/** What the browser sends on the chat channel: only typing signals. Browser-safe. */
export interface ChatLiveClientMessage {
  chatId: number;
  type: "typing";
}

/** What the server pushes to every member's open tabs. Browser-safe. */
export type ChatLiveServerMessage =
  | { chatId: number; message: ChatMessage; type: "message" }
  | { chatId: number; message: ChatMessage; type: "message_updated" }
  | {
      chatId: number;
      messageId: number;
      reactions: ChatReactionSummary[];
      type: "reactions";
    }
  | { chatId: number; messageId: number; type: "message_deleted" }
  | { chatId: number; messageId: number; type: "read"; userId: number }
  | { chatId: number; type: "chat" }
  | { chatId: number; type: "typing"; userId: number }
  | { requests: number; type: "state"; unreadChats: number };

/** Core's chat channel on the shared WebSocket. Browser-safe. */
export const chatLiveChannel = createWebSocketChannel<
  ChatLiveClientMessage,
  ChatLiveServerMessage
>({ pluginId: "@vitnode/core", module: "chat", id: "live" });
