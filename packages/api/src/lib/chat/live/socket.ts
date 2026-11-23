import { z } from "zod";

import { buildWebSocket } from "@/lib/websocket";

import { CHAT_LIMITS } from "../const";
import { relayChatTyping } from "../service";

const clientMessageSchema = z.strictObject({
  chatId: z.number().int().positive(),
  type: z.literal("typing"),
});

const lastTyping = new Map<string, number>();

const throttled = (key: string): boolean => {
  const now = Date.now();
  const last = lastTyping.get(key);
  if (last && now - last < CHAT_LIMITS.typingThrottleSeconds * 1000) {
    return true;
  }
  lastTyping.set(key, now);
  if (lastTyping.size > 10_000) {
    for (const [entry, at] of lastTyping) {
      if (now - at > CHAT_LIMITS.typingExpireSeconds * 1000) {
        lastTyping.delete(entry);
      }
    }
  }

  return false;
};

/** "Typing…" signals: the browser sends them, the server relays them to the chat's members. */
export const chatLiveWebSocket = buildWebSocket({
  description:
    "Live chat: typing signals from the browser, relayed to the other members of the chat. Messages, reactions and read state are pushed by the HTTP writes.",
  id: "live",
  onMessage: async ({ c, data }) => {
    const parsed = clientMessageSchema.safeParse(data);
    const user = c.get("user");
    if (!parsed.success || !user) return;
    if (throttled(`${user.id}:${parsed.data.chatId}`)) return;
    await relayChatTyping(c, parsed.data.chatId);
  },
});
