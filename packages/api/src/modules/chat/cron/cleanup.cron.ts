import { and, lt, sql } from "drizzle-orm";

import {
  core_chat_conversations,
  core_chat_participants,
  core_chat_request_outcomes,
} from "@/database/chat";
import { deleteChats, orphanChatIds } from "@/lib/chat/service";
import { buildCron } from "@/lib/cron";

const OUTCOME_RETENTION_DAYS = 30;
const HIDDEN_DIRECT_DAYS = 7;

/**
 * Deletes chats nobody is in any more, direct chats both sides hid a week
 * ago with nothing new since, and old request outcomes.
 */
export const chatCleanupCron = buildCron({
  name: "chat-cleanup",
  description:
    "Delete chats nobody is in any more, long-hidden direct chats and old chat request outcomes",
  schedule: "41 4 * * *",
  handler: async c => {
    const db = c.get("db");
    await deleteChats(db, await orphanChatIds(db));

    const hidden = await db
      .select({ id: core_chat_conversations.id })
      .from(core_chat_conversations)
      .where(
        and(
          sql`${core_chat_conversations.kind} = 'direct'`,
          lt(
            core_chat_conversations.lastMessageAt,
            new Date(Date.now() - HIDDEN_DIRECT_DAYS * 24 * 60 * 60 * 1000),
          ),
          sql`not exists (select 1 from ${core_chat_participants} where ${core_chat_participants.conversationId} = ${core_chat_conversations.id} and ${core_chat_participants.leftAt} is null and (${core_chat_participants.hiddenUntilMessageId} is null or ${core_chat_participants.hiddenUntilMessageId} < ${core_chat_conversations.lastMessageId}))`,
        ),
      );
    await deleteChats(
      db,
      hidden.map(row => row.id),
    );

    await db
      .delete(core_chat_request_outcomes)
      .where(
        lt(
          core_chat_request_outcomes.createdAt,
          new Date(Date.now() - OUTCOME_RETENTION_DAYS * 24 * 60 * 60 * 1000),
        ),
      );
  },
});
