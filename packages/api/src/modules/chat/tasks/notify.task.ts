import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { buildQueueTask } from "@/builders";
import {
  core_chat_conversations,
  core_chat_messages,
  core_chat_participants,
} from "@/database/chat";
import { chatMessageNotification } from "@/lib/notifications/core-types";

/**
 * Runs a couple of minutes after a message: notifies the member (email by
 * default) only when they still haven't read it and the chat isn't muted.
 */
export const chatNotifyQueueTask = buildQueueTask({
  name: "chat-notify",
  payload: z.object({
    chatId: z.number().int().positive(),
    messageId: z.number().int().positive(),
    userId: z.number().int().positive(),
  }),
  description:
    "Notify a member about chat messages they did not read within a couple of minutes",
  maxAttempts: 3,
  handler: async (c, { chatId, messageId, userId }) => {
    if (!c.get("core").chat.enabled) return;
    const db = c.get("db");
    const [row] = await db
      .select({
        kind: core_chat_conversations.kind,
        lastReadMessageId: core_chat_participants.lastReadMessageId,
        mutedUntil: core_chat_participants.mutedUntil,
        status: core_chat_participants.status,
        title: core_chat_conversations.title,
      })
      .from(core_chat_participants)
      .innerJoin(
        core_chat_conversations,
        eq(core_chat_conversations.id, core_chat_participants.conversationId),
      )
      .where(
        and(
          eq(core_chat_participants.conversationId, chatId),
          eq(core_chat_participants.userId, userId),
          isNull(core_chat_participants.leftAt),
        ),
      )
      .limit(1);
    if (
      !row ||
      row.status !== "accepted" ||
      row.lastReadMessageId >= messageId ||
      (row.mutedUntil && row.mutedUntil.getTime() > Date.now())
    ) {
      return;
    }

    const [message] = await db
      .select({
        authorId: core_chat_messages.authorId,
        deletedAt: core_chat_messages.deletedAt,
      })
      .from(core_chat_messages)
      .where(eq(core_chat_messages.id, messageId))
      .limit(1);
    if (!message || message.deletedAt) return;

    await c.get("notifications").publish({
      actorId: message.authorId,
      data: { chatId, kind: row.kind, title: row.title },
      idempotencyKey: `chat:${chatId}:${userId}:${messageId}`,
      recipients: [userId],
      subject: { id: chatId, type: "core.chat" },
      type: chatMessageNotification,
    });
  },
});
