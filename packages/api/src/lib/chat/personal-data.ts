import type { Context } from "hono";

import { asc, eq, inArray, sql } from "drizzle-orm";

import type { ContentDatabase } from "@/content/server/service";

import {
  core_chat_conversations,
  core_chat_message_reactions,
  core_chat_messages,
  core_chat_participants,
  core_chat_user_keys,
  core_users_blocks,
} from "@/database/chat";
import { core_users } from "@/database/users";

import { deleteChats, orphanChatIds } from "./service";

/**
 * A member's chat data for their GDPR export: their own messages, reactions,
 * the chats they are in, their block list and settings. Other people's
 * messages are left out - they are those people's data.
 */
export const exportChatData = async (c: Context, userId: number) => {
  const db = c.get("db");
  const [settings, chats, messages, reactions, blocks, keys] =
    await Promise.all([
      db
        .select({
          chatRequestsFrom: core_users.chatRequestsFrom,
          showReadReceipts: core_users.showReadReceipts,
        })
        .from(core_users)
        .where(eq(core_users.id, userId))
        .limit(1),
      db
        .select({
          chatId: core_chat_participants.conversationId,
          joinedAt: core_chat_participants.invitedAt,
          kind: core_chat_conversations.kind,
          leftAt: core_chat_participants.leftAt,
          status: core_chat_participants.status,
          title: core_chat_conversations.title,
        })
        .from(core_chat_participants)
        .innerJoin(
          core_chat_conversations,
          eq(core_chat_conversations.id, core_chat_participants.conversationId),
        )
        .where(eq(core_chat_participants.userId, userId)),
      db
        .select({
          body: core_chat_messages.body,
          chatId: core_chat_messages.conversationId,
          createdAt: core_chat_messages.createdAt,
          deletedAt: core_chat_messages.deletedAt,
          editedAt: core_chat_messages.editedAt,
          /** `body` is ciphertext only the member's browser can read. */
          encrypted: core_chat_messages.encrypted,
          id: core_chat_messages.id,
        })
        .from(core_chat_messages)
        .where(eq(core_chat_messages.authorId, userId))
        .orderBy(asc(core_chat_messages.id)),
      db
        .select({
          createdAt: core_chat_message_reactions.createdAt,
          emoji: core_chat_message_reactions.emoji,
          messageId: core_chat_message_reactions.messageId,
        })
        .from(core_chat_message_reactions)
        .where(eq(core_chat_message_reactions.userId, userId)),
      db
        .select({
          blockedAt: core_users_blocks.createdAt,
          blockedUserId: core_users_blocks.blockedUserId,
        })
        .from(core_users_blocks)
        .where(eq(core_users_blocks.userId, userId)),
      db
        .select({
          createdAt: core_chat_user_keys.createdAt,
          keyVersion: core_chat_user_keys.keyVersion,
          publicKey: core_chat_user_keys.publicKey,
        })
        .from(core_chat_user_keys)
        .where(eq(core_chat_user_keys.userId, userId)),
    ]);
  const iso = (value: Date | null) => value?.toISOString() ?? null;

  return {
    settings: settings[0] ?? null,
    chats: chats.map(row => ({
      ...row,
      joinedAt: iso(row.joinedAt),
      leftAt: iso(row.leftAt),
    })),
    messages: messages.map(row => ({
      ...row,
      createdAt: iso(row.createdAt),
      deletedAt: iso(row.deletedAt),
      editedAt: iso(row.editedAt),
    })),
    reactions: reactions.map(row => ({
      ...row,
      createdAt: iso(row.createdAt),
    })),
    // The wrapped private key is left out: it is useless without the
    // passcode, and the passcode is something only the member knows.
    encryption: keys[0]
      ? { ...keys[0], createdAt: iso(keys[0].createdAt) }
      : null,
    blockedMembers: blocks.map(row => ({
      ...row,
      blockedAt: iso(row.blockedAt),
    })),
  };
};

/**
 * Takes an erased member out of their chats. Their messages stay for the
 * other members with the author removed (the foreign key does it); chats
 * left with nobody are deleted.
 */
export const eraseChatData = async (
  tx: ContentDatabase,
  userId: number,
): Promise<void> => {
  const rows = await tx
    .delete(core_chat_participants)
    .where(eq(core_chat_participants.userId, userId))
    .returning({ chatId: core_chat_participants.conversationId });
  const chatIds = [...new Set(rows.map(row => row.chatId))];
  if (chatIds.length > 0) {
    await tx
      .update(core_chat_conversations)
      .set({
        membersCount: sql`(select count(*) from ${core_chat_participants} where ${core_chat_participants.conversationId} = ${core_chat_conversations.id} and ${core_chat_participants.leftAt} is null)`,
      })
      .where(inArray(core_chat_conversations.id, chatIds));
  }
  await deleteChats(tx, await orphanChatIds(tx));
};
