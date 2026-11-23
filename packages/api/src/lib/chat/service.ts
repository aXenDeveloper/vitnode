import type { Context } from "hono";

import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";

import type { ContentDatabase } from "@/content/server/service";

import {
  core_chat_conversations,
  core_chat_message_reactions,
  core_chat_messages,
  core_chat_participants,
  core_chat_request_outcomes,
  core_users_blocks,
} from "@/database/chat";
import { core_users } from "@/database/users";
import {
  chatCreatedEvent,
  chatMemberAddedEvent,
  chatMemberRemovedEvent,
  chatMessageCreatedEvent,
  chatMessageDeletedEvent,
  chatMessageUpdatedEvent,
  chatRequestAcceptedEvent,
  chatRequestIgnoredEvent,
  userBlockedEvent,
  userUnblockedEvent,
} from "@/events/chat";
import { chatRequestNotification } from "@/lib/notifications/core-types";
import { chatNotifyQueueTask } from "@/modules/chat/tasks/notify.task";

import type { ChatKind, ChatSystemEvent } from "./const";
import type { ChatMembership, ChatMessageRow } from "./read";
import type { ChatMessage } from "./types";

import { CHAT_LIMITS, chatDirectKey } from "./const";
import { pushChat, pushChatEach, pushChatState } from "./live/publish";
import {
  blockedBetween,
  chatRequestsPausedUntil,
  chatsStartedToday,
  checkChatRecipients,
  resolveChatPolicy,
} from "./policy";
import {
  activeMembers,
  canReadMessages,
  loadMembership,
  reactionSummaries,
  toChatMessages,
} from "./read";

/** Stable codes the chat routes answer with. */
export type ChatErrorCode =
  | "blocked"
  | "chat_disabled"
  | "daily_limit"
  | "edit_window"
  | "group_full"
  | "groups_disabled"
  | "invalid"
  | "not_allowed"
  | "not_found"
  | "recipient_unavailable"
  | "request_limit"
  | "requests_paused"
  | "too_many_invites"
  | "too_many_reactions";

const STATUS: Record<ChatErrorCode, 400 | 403 | 404 | 409 | 429> = {
  blocked: 403,
  groups_disabled: 403,
  chat_disabled: 404,
  daily_limit: 429,
  edit_window: 403,
  group_full: 409,
  invalid: 400,
  not_allowed: 403,
  not_found: 404,
  recipient_unavailable: 403,
  request_limit: 429,
  requests_paused: 429,
  too_many_invites: 400,
  too_many_reactions: 409,
};

/** A refused chat write; routes map it to `{ error: code }`. */
export class ChatError extends Error {
  constructor(code: ChatErrorCode, until: Date | null = null) {
    super(`[Chat] ${code}`);
    this.name = "ChatError";
    this.code = code;
    this.status = STATUS[code];
    this.until = until;
  }
  readonly code: ChatErrorCode;
  readonly status: 400 | 403 | 404 | 409 | 429;

  readonly until: Date | null;
}

const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

const requireUserId = (c: Context): number => {
  if (!c.get("core").chat.enabled) throw new ChatError("chat_disabled");
  const user = c.get("user");
  if (!user) throw new ChatError("not_found");

  return user.id;
};

const requireMembership = async (
  c: Context,
  chatId: number,
  userId: number,
): Promise<ChatMembership> => {
  const membership = await loadMembership(c, chatId, userId);
  if (!membership) throw new ChatError("not_found");

  return membership;
};

const normalizeBody = (body: string): string => {
  const text = body.replace(/\r\n?/gu, "\n").trim();
  if (!text || text.length > CHAT_LIMITS.messageMaxLength) {
    throw new ChatError("invalid");
  }

  return text;
};

const cleanTitle = (title: null | string | undefined): null | string => {
  const trimmed = title?.trim().slice(0, CHAT_LIMITS.titleMaxLength) ?? "";

  return trimmed.length > 0 ? trimmed : null;
};

const lockChat = async (tx: ContentDatabase, chatId: number) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`core_chat:${chatId}`}))`,
  );
};

const insertMessage = async (
  tx: ContentDatabase,
  values: {
    authorId: null | number;
    body?: null | string;
    chatId: number;
    clientId?: null | string;
    replyToMessageId?: null | number;
    sentAsRequest?: boolean;
    system?: ChatSystemEvent;
  },
): Promise<ChatMessageRow> => {
  await lockChat(tx, values.chatId);
  const [row] = await tx
    .insert(core_chat_messages)
    .values({
      authorId: values.authorId,
      body: values.body ?? null,
      clientId: values.clientId ?? null,
      conversationId: values.chatId,
      kind: values.system ? "system" : "message",
      replyToMessageId: values.replyToMessageId ?? null,
      sentAsRequest: values.sentAsRequest ?? false,
      system: values.system ?? null,
    })
    .returning();
  await tx
    .update(core_chat_conversations)
    .set({ lastMessageAt: row.createdAt, lastMessageId: row.id })
    .where(eq(core_chat_conversations.id, values.chatId));
  // A new message brings a hidden chat back for everyone who hid it.
  await tx
    .update(core_chat_participants)
    .set({ hiddenUntilMessageId: null })
    .where(
      and(
        eq(core_chat_participants.conversationId, values.chatId),
        isNotNull(core_chat_participants.hiddenUntilMessageId),
      ),
    );
  if (values.authorId) {
    await tx
      .update(core_chat_participants)
      .set({ lastReadMessageId: row.id })
      .where(
        and(
          eq(core_chat_participants.conversationId, values.chatId),
          eq(core_chat_participants.userId, values.authorId),
        ),
      );
  }

  return row;
};

const recountMembers = async (tx: ContentDatabase, chatId: number) => {
  await tx
    .update(core_chat_conversations)
    .set({
      membersCount: sql`(select count(*) from ${core_chat_participants} where ${core_chat_participants.conversationId} = ${chatId} and ${core_chat_participants.leftAt} is null)`,
    })
    .where(eq(core_chat_conversations.id, chatId));
};

/** Who sees a message live: accepted members, and both sides of a direct request. */
const audienceOf = (
  kind: ChatKind,
  members: Awaited<ReturnType<typeof activeMembers>>,
): number[] =>
  members
    .filter(member => member.status === "accepted" || kind === "direct")
    .map(member => member.userId);

/**
 * Publishes a new message: live push, delayed notifications, event and the
 * unread counts.
 */
const afterMessage = async (
  c: Context,
  chat: { id: number; kind: ChatKind },
  row: ChatMessageRow,
): Promise<ChatMessage> => {
  const members = await activeMembers(c, chat.id);
  const [message] = await toChatMessages(c, [row], row.authorId ?? 0, {
    withReactions: false,
  });
  const audience = audienceOf(chat.kind, members);
  pushChat(c, audience, { chatId: chat.id, message, type: "message" });
  if (row.kind === "message" && row.authorId) {
    const now = Date.now();
    const recipients = members.filter(
      member =>
        member.userId !== row.authorId &&
        member.status === "accepted" &&
        !(member.mutedUntil && member.mutedUntil.getTime() > now),
    );
    for (const member of recipients) {
      await c.get("queue").dispatch(
        chatNotifyQueueTask,
        { chatId: chat.id, messageId: row.id, userId: member.userId },
        {
          availableAt: new Date(
            now + CHAT_LIMITS.notifyDelayMinutes * 60 * 1000,
          ),
          dedupeKey: `chat-notify:${chat.id}:${member.userId}`,
        },
      );
    }
    await c.get("events").emit(chatMessageCreatedEvent, {
      authorId: row.authorId,
      chatId: chat.id,
      kind: chat.kind,
      messageId: row.id,
    });
  }
  await pushChatState(
    c,
    members.map(member => member.userId),
  );

  return message;
};

/** Whether a direct chat's sender is still waiting for the other side to accept. */
const pendingOtherInDirect = async (
  c: Context,
  chatId: number,
  userId: number,
): Promise<boolean> => {
  const [row] = await c
    .get("db")
    .select({ count: sql<string>`count(*)` })
    .from(core_chat_participants)
    .where(
      and(
        eq(core_chat_participants.conversationId, chatId),
        ne(core_chat_participants.userId, userId),
        eq(core_chat_participants.status, "pending"),
        isNull(core_chat_participants.leftAt),
      ),
    );

  return Number(row?.count ?? 0) > 0;
};

export interface SendMessageInput {
  body: string;
  clientId?: null | string;
  replyToMessageId?: null | number;
}

/** Sends a message to a chat the member is in. */
export const sendChatMessage = async (
  c: Context,
  chatId: number,
  input: SendMessageInput,
): Promise<ChatMessage> => {
  const userId = requireUserId(c);
  const policy = await resolveChatPolicy(c);
  if (!policy.allowChat) throw new ChatError("not_allowed");
  const membership = await requireMembership(c, chatId, userId);
  const { chat, participant } = membership;
  if (!canReadMessages(membership)) throw new ChatError("not_allowed");
  const body = normalizeBody(input.body);
  const db = c.get("db");

  if (input.clientId) {
    const [existing] = await db
      .select()
      .from(core_chat_messages)
      .where(
        and(
          eq(core_chat_messages.authorId, userId),
          eq(core_chat_messages.clientId, input.clientId),
        ),
      )
      .limit(1);
    if (existing) {
      if (existing.conversationId !== chatId) throw new ChatError("invalid");
      const [message] = await toChatMessages(c, [existing], userId);

      return message;
    }
  }

  if (chat.kind === "direct" && !policy.canMessageAnyone) {
    const members = await activeMembers(c, chatId);
    const others = members
      .map(member => member.userId)
      .filter(id => id !== userId);
    const blocks = await blockedBetween(c, userId, others);
    if (blocks.blockedByMe.size > 0 || blocks.blockedMe.size > 0) {
      throw new ChatError("blocked");
    }
  }

  let sentAsRequest = false;
  if (chat.kind === "direct" && participant.status === "accepted") {
    sentAsRequest = await pendingOtherInDirect(c, chatId, userId);
    if (sentAsRequest) {
      const [sent] = await db
        .select({ count: sql<string>`count(*)` })
        .from(core_chat_messages)
        .where(
          and(
            eq(core_chat_messages.conversationId, chatId),
            eq(core_chat_messages.authorId, userId),
            eq(core_chat_messages.sentAsRequest, true),
          ),
        );
      if (Number(sent?.count ?? 0) >= CHAT_LIMITS.pendingMessages) {
        throw new ChatError("request_limit");
      }
    }
  }

  if (input.replyToMessageId) {
    const [reply] = await db
      .select({ id: core_chat_messages.id })
      .from(core_chat_messages)
      .where(
        and(
          eq(core_chat_messages.id, input.replyToMessageId),
          eq(core_chat_messages.conversationId, chatId),
          sql`${core_chat_messages.id} >= ${participant.firstVisibleMessageId}`,
        ),
      )
      .limit(1);
    if (!reply) throw new ChatError("invalid");
  }

  // Replying to a request accepts it, as on most chat apps.
  const accepting = participant.status === "pending";
  const row = await db.transaction(async (tx: ContentDatabase) => {
    if (accepting) {
      await tx
        .update(core_chat_participants)
        .set({ acceptedAt: new Date(), status: "accepted" })
        .where(
          and(
            eq(core_chat_participants.conversationId, chatId),
            eq(core_chat_participants.userId, userId),
          ),
        );
    }

    return await insertMessage(tx, {
      authorId: userId,
      body,
      chatId,
      clientId: input.clientId,
      replyToMessageId: input.replyToMessageId,
      sentAsRequest,
    });
  });
  if (accepting) await afterAccept(c, chat, participant.invitedById, userId);

  return await afterMessage(c, chat, row);
};

export interface StartChatInput {
  body?: null | string;
  clientId?: null | string;
  title?: null | string;
  userIds: number[];
}

/**
 * Starts a chat: a direct one with one person (or the existing one with
 * them), otherwise a group. People with no accepted chat with the sender get
 * it as a request.
 */
export const startChat = async (
  c: Context,
  input: StartChatInput,
): Promise<{ chatId: number; created: boolean }> => {
  const userId = requireUserId(c);
  const policy = await resolveChatPolicy(c);
  if (!policy.allowChat) throw new ChatError("not_allowed");
  const userIds = [...new Set(input.userIds)].filter(id => id !== userId);
  if (userIds.length === 0) throw new ChatError("invalid");
  const { maxGroupSize } = c.get("core").chat;
  if (policy.maxInvites !== null && userIds.length > policy.maxInvites) {
    throw new ChatError("too_many_invites");
  }
  if (userIds.length + 1 > maxGroupSize) throw new ChatError("group_full");
  const body = input.body ? normalizeBody(input.body) : null;
  const kind: ChatKind = userIds.length === 1 ? "direct" : "group";
  if (kind === "group" && !c.get("core").chat.groups) {
    throw new ChatError("groups_disabled");
  }
  if (kind === "direct" && !body) throw new ChatError("invalid");
  const title = kind === "group" ? cleanTitle(input.title) : null;
  const db = c.get("db");

  if (kind === "direct") {
    const [existing] = await db
      .select({ id: core_chat_conversations.id })
      .from(core_chat_conversations)
      .where(
        eq(
          core_chat_conversations.directKey,
          chatDirectKey(userId, userIds[0]),
        ),
      )
      .limit(1);
    if (existing) {
      const mine = await loadMembership(c, existing.id, userId);
      if (!mine) {
        // The member once ignored this chat's request: rejoin it, without
        // the history they turned down.
        const [check] = await checkChatRecipients(c, {
          policy,
          recipientIds: userIds,
          senderId: userId,
        });
        if (!check?.allowed) throw new ChatError("recipient_unavailable");
        await db.transaction(async (tx: ContentDatabase) => {
          await lockChat(tx, existing.id);
          const [fresh] = await tx
            .select({ lastMessageId: core_chat_conversations.lastMessageId })
            .from(core_chat_conversations)
            .where(eq(core_chat_conversations.id, existing.id));
          const values = {
            acceptedAt: new Date(),
            firstVisibleMessageId: (fresh?.lastMessageId ?? 0) + 1,
            hiddenUntilMessageId: null,
            invitedById: null,
            lastReadMessageId: fresh?.lastMessageId ?? 0,
            leftAt: null,
            status: "accepted" as const,
          };
          await tx
            .insert(core_chat_participants)
            .values({ ...values, conversationId: existing.id, userId })
            .onConflictDoUpdate({
              set: values,
              target: [
                core_chat_participants.conversationId,
                core_chat_participants.userId,
              ],
            });
          await recountMembers(tx, existing.id);
        });
      }
      await sendChatMessage(c, existing.id, {
        body: body ?? "",
        clientId: input.clientId,
      });

      return { chatId: existing.id, created: false };
    }
  }

  const checks = await checkChatRecipients(c, {
    policy,
    recipientIds: userIds,
    senderId: userId,
  });
  if (checks.some(check => !check.allowed)) {
    throw new ChatError("recipient_unavailable");
  }
  const pendingIds = checks.flatMap(check =>
    check.allowed && check.asRequest ? [check.userId] : [],
  );
  if (pendingIds.length > 0 && !policy.canMessageAnyone) {
    const until = await chatRequestsPausedUntil(c, userId);
    if (until) throw new ChatError("requests_paused", until);
  }
  if (
    policy.requestsPerDay !== null &&
    (await chatsStartedToday(c, userId)) >= policy.requestsPerDay
  ) {
    throw new ChatError("daily_limit");
  }

  const { chatId, row } = await db.transaction(async (tx: ContentDatabase) => {
    const directKey =
      kind === "direct" ? chatDirectKey(userId, userIds[0]) : null;
    const [chat] = await tx
      .insert(core_chat_conversations)
      .values({
        directKey,
        hostId: userId,
        kind,
        membersCount: userIds.length + 1,
        title,
      })
      .returning({ id: core_chat_conversations.id });
    await tx.insert(core_chat_participants).values([
      {
        acceptedAt: new Date(),
        conversationId: chat.id,
        status: "accepted",
        userId,
      },
      ...checks.flatMap(check =>
        check.allowed
          ? [
              {
                acceptedAt: check.asRequest ? null : new Date(),
                conversationId: chat.id,
                invitedById: userId,
                status: check.asRequest
                  ? ("pending" as const)
                  : ("accepted" as const),
                userId: check.userId,
              },
            ]
          : [],
      ),
    ]);
    if (kind === "group") {
      await insertMessage(tx, {
        authorId: userId,
        chatId: chat.id,
        system: { type: "created" },
      });
    }
    const message = body
      ? await insertMessage(tx, {
          authorId: userId,
          body,
          chatId: chat.id,
          clientId: input.clientId,
          sentAsRequest: kind === "direct" && pendingIds.length > 0,
        })
      : null;

    return { chatId: chat.id, row: message };
  });

  await c.get("events").emit(chatCreatedEvent, {
    chatId,
    kind,
    memberIds: userIds,
    pendingUserIds: pendingIds,
    userId,
  });
  if (pendingIds.length > 0) {
    await c.get("notifications").publish({
      actorId: userId,
      data: { chatId, kind, title },
      idempotencyKey: `chat-request:${chatId}`,
      recipients: pendingIds,
      subject: { id: chatId, type: "core.chat" },
      type: chatRequestNotification,
    });
  }
  pushChat(c, userIds, { chatId, type: "chat" });
  if (row) {
    await afterMessage(c, { id: chatId, kind }, row);
  } else {
    await pushChatState(c, [userId, ...userIds]);
  }

  return { chatId, created: true };
};

const findOwnMessage = async (
  c: Context,
  chatId: number,
  messageId: number,
  userId: number,
): Promise<ChatMessageRow> => {
  const [row] = await c
    .get("db")
    .select()
    .from(core_chat_messages)
    .where(
      and(
        eq(core_chat_messages.id, messageId),
        eq(core_chat_messages.conversationId, chatId),
      ),
    )
    .limit(1);
  if (!row || row.kind !== "message" || row.deletedAt) {
    throw new ChatError("not_found");
  }
  if (row.authorId !== userId) throw new ChatError("not_allowed");

  return row;
};

/** Edits the member's own message within the edit window. */
export const editChatMessage = async (
  c: Context,
  chatId: number,
  messageId: number,
  input: { body: string },
): Promise<ChatMessage> => {
  const userId = requireUserId(c);
  const membership = await requireMembership(c, chatId, userId);
  const row = await findOwnMessage(c, chatId, messageId, userId);
  if (row.hiddenByModeratorAt) throw new ChatError("not_allowed");
  const { editWindowMinutes } = c.get("core").chat;
  if (Date.now() - row.createdAt.getTime() > editWindowMinutes * 60 * 1000) {
    throw new ChatError("edit_window");
  }
  const body = normalizeBody(input.body);
  const [updated] = await c
    .get("db")
    .update(core_chat_messages)
    .set({ body, editedAt: new Date() })
    .where(eq(core_chat_messages.id, messageId))
    .returning();
  const members = await activeMembers(c, chatId);
  const views = await Promise.all(
    audienceOf(membership.chat.kind, members).map(async memberId => ({
      data: {
        chatId,
        message: (await toChatMessages(c, [updated], memberId))[0],
        type: "message_updated" as const,
      },
      userId: memberId,
    })),
  );
  pushChatEach(c, views);
  await c.get("events").emit(chatMessageUpdatedEvent, {
    authorId: userId,
    chatId,
    kind: membership.chat.kind,
    messageId,
  });

  return (await toChatMessages(c, [updated], userId))[0];
};

/** Deletes the member's own message, leaving a tombstone. */
export const deleteChatMessage = async (
  c: Context,
  chatId: number,
  messageId: number,
): Promise<void> => {
  const userId = requireUserId(c);
  const membership = await requireMembership(c, chatId, userId);
  await findOwnMessage(c, chatId, messageId, userId);
  await c.get("db").transaction(async (tx: ContentDatabase) => {
    await tx
      .update(core_chat_messages)
      .set({ body: null, deletedAt: new Date() })
      .where(eq(core_chat_messages.id, messageId));
    await tx
      .delete(core_chat_message_reactions)
      .where(eq(core_chat_message_reactions.messageId, messageId));
  });
  const members = await activeMembers(c, chatId);
  pushChat(c, audienceOf(membership.chat.kind, members), {
    chatId,
    messageId,
    type: "message_deleted",
  });
  await c.get("events").emit(chatMessageDeletedEvent, {
    authorId: userId,
    chatId,
    kind: membership.chat.kind,
    messageId,
  });
};

/** Adds or removes the member's emoji on a message. */
export const setChatReaction = async (
  c: Context,
  chatId: number,
  messageId: number,
  emoji: string,
  add: boolean,
) => {
  const userId = requireUserId(c);
  const membership = await requireMembership(c, chatId, userId);
  if (membership.participant.status !== "accepted") {
    throw new ChatError("not_allowed");
  }
  if (!emoji || emoji.length > 32 || !EMOJI_PATTERN.test(emoji)) {
    throw new ChatError("invalid");
  }
  const db = c.get("db");
  const [message] = await db
    .select()
    .from(core_chat_messages)
    .where(
      and(
        eq(core_chat_messages.id, messageId),
        eq(core_chat_messages.conversationId, chatId),
        sql`${core_chat_messages.id} >= ${membership.participant.firstVisibleMessageId}`,
      ),
    )
    .limit(1);
  if (
    !message ||
    message.kind !== "message" ||
    message.deletedAt ||
    message.hiddenByModeratorAt
  ) {
    throw new ChatError("not_found");
  }

  if (add) {
    const existing = await db
      .selectDistinct({ emoji: core_chat_message_reactions.emoji })
      .from(core_chat_message_reactions)
      .where(eq(core_chat_message_reactions.messageId, messageId));
    if (
      existing.length >= CHAT_LIMITS.reactionsPerMessage &&
      !existing.some(row => row.emoji === emoji)
    ) {
      throw new ChatError("too_many_reactions");
    }
    await db
      .insert(core_chat_message_reactions)
      .values({ emoji, messageId, userId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(core_chat_message_reactions)
      .where(
        and(
          eq(core_chat_message_reactions.messageId, messageId),
          eq(core_chat_message_reactions.userId, userId),
          eq(core_chat_message_reactions.emoji, emoji),
        ),
      );
  }

  const members = await activeMembers(c, chatId);
  const audience = audienceOf(membership.chat.kind, members);
  const views = await Promise.all(
    audience.map(async memberId => ({
      data: {
        chatId,
        messageId,
        reactions:
          (await reactionSummaries(c, [messageId], memberId)).get(messageId) ??
          [],
        type: "reactions" as const,
      },
      userId: memberId,
    })),
  );
  pushChatEach(c, views);

  return views.find(view => view.userId === userId)?.data.reactions ?? [];
};

/** Moves the member's read cursor forward to `messageId`. */
export const markChatRead = async (
  c: Context,
  chatId: number,
  messageId: number,
): Promise<void> => {
  const userId = requireUserId(c);
  const membership = await requireMembership(c, chatId, userId);
  const target = Math.min(messageId, membership.chat.lastMessageId ?? 0);
  if (target <= membership.participant.lastReadMessageId) return;
  await c
    .get("db")
    .update(core_chat_participants)
    .set({
      lastReadMessageId: sql`greatest(${core_chat_participants.lastReadMessageId}, ${target})`,
    })
    .where(
      and(
        eq(core_chat_participants.conversationId, chatId),
        eq(core_chat_participants.userId, userId),
      ),
    );
  const members = await activeMembers(c, chatId);
  const me = members.find(member => member.userId === userId);
  if (me?.showReadReceipts) {
    pushChat(
      c,
      members
        .filter(
          member =>
            member.userId !== userId &&
            member.showReadReceipts &&
            member.status === "accepted",
        )
        .map(member => member.userId),
      { chatId, messageId: target, type: "read", userId },
    );
  }
  await pushChatState(c, [userId]);
};

const afterAccept = async (
  c: Context,
  chat: { id: number; kind: ChatKind },
  invitedById: null | number,
  userId: number,
) => {
  if (invitedById) {
    await c.get("db").insert(core_chat_request_outcomes).values({
      outcome: "accepted",
      recipientId: userId,
      senderId: invitedById,
    });
  }
  await c.get("events").emit(chatRequestAcceptedEvent, {
    chatId: chat.id,
    kind: chat.kind,
    userId,
  });
  const members = await activeMembers(c, chat.id);
  pushChat(
    c,
    members.map(member => member.userId),
    { chatId: chat.id, type: "chat" },
  );
};

/** Accepts a chat request or a group invite. */
export const acceptChatRequest = async (
  c: Context,
  chatId: number,
): Promise<void> => {
  const userId = requireUserId(c);
  const { chat, participant } = await requireMembership(c, chatId, userId);
  if (participant.status !== "pending") return;
  await c
    .get("db")
    .update(core_chat_participants)
    .set({ acceptedAt: new Date(), status: "accepted" })
    .where(
      and(
        eq(core_chat_participants.conversationId, chatId),
        eq(core_chat_participants.userId, userId),
      ),
    );
  await afterAccept(c, chat, participant.invitedById, userId);
  await pushChatState(c, [userId]);
};

/** Blocks a member; they can't start chats with or add the blocker. */
export const blockUser = async (
  c: Context,
  blockedUserId: number,
): Promise<void> => {
  const user = c.get("user");
  if (!user) throw new ChatError("not_found");
  if (blockedUserId === user.id) throw new ChatError("invalid");
  const db = c.get("db");
  const [target] = await db
    .select({ id: core_users.id })
    .from(core_users)
    .where(eq(core_users.id, blockedUserId))
    .limit(1);
  if (!target) throw new ChatError("not_found");
  const [count] = await db
    .select({ count: sql<string>`count(*)` })
    .from(core_users_blocks)
    .where(eq(core_users_blocks.userId, user.id));
  if (Number(count?.count ?? 0) >= CHAT_LIMITS.maxBlocks) {
    throw new ChatError("invalid");
  }
  const inserted = await db
    .insert(core_users_blocks)
    .values({ blockedUserId, userId: user.id })
    .onConflictDoNothing()
    .returning({ userId: core_users_blocks.userId });
  if (inserted.length > 0) {
    await c
      .get("events")
      .emit(userBlockedEvent, { blockedUserId, userId: user.id });
  }
};

/** Removes a block. */
export const unblockUser = async (
  c: Context,
  blockedUserId: number,
): Promise<void> => {
  const user = c.get("user");
  if (!user) throw new ChatError("not_found");
  const removed = await c
    .get("db")
    .delete(core_users_blocks)
    .where(
      and(
        eq(core_users_blocks.userId, user.id),
        eq(core_users_blocks.blockedUserId, blockedUserId),
      ),
    )
    .returning({ userId: core_users_blocks.userId });
  if (removed.length > 0) {
    await c
      .get("events")
      .emit(userUnblockedEvent, { blockedUserId, userId: user.id });
  }
};

/** Ignores a request: the member's row goes away; `block` blocks the inviter too. */
export const ignoreChatRequest = async (
  c: Context,
  chatId: number,
  { block }: { block: boolean },
): Promise<void> => {
  const userId = requireUserId(c);
  const { chat, participant } = await requireMembership(c, chatId, userId);
  if (participant.status !== "pending") throw new ChatError("invalid");
  await c.get("db").transaction(async (tx: ContentDatabase) => {
    await tx
      .delete(core_chat_participants)
      .where(
        and(
          eq(core_chat_participants.conversationId, chatId),
          eq(core_chat_participants.userId, userId),
        ),
      );
    await recountMembers(tx, chatId);
    if (participant.invitedById) {
      await tx.insert(core_chat_request_outcomes).values({
        outcome: block ? "blocked" : "ignored",
        recipientId: userId,
        senderId: participant.invitedById,
      });
    }
  });
  if (block && participant.invitedById) {
    await blockUser(c, participant.invitedById);
  }
  await c.get("events").emit(chatRequestIgnoredEvent, {
    blocked: block,
    chatId,
    kind: chat.kind,
    userId,
  });
  await pushChatState(c, [userId]);
};

export interface UpdateChatInput {
  hidden?: boolean;
  membersCanInvite?: boolean;
  mutedUntil?: null | string;
  title?: null | string;
}

/** Host settings (title, invites) and the member's own (mute, hide). */
export const updateChat = async (
  c: Context,
  chatId: number,
  input: UpdateChatInput,
): Promise<void> => {
  const userId = requireUserId(c);
  const { chat, participant } = await requireMembership(c, chatId, userId);
  const db = c.get("db");
  const hostChange =
    input.title !== undefined || input.membersCanInvite !== undefined;
  if (hostChange) {
    if (
      chat.kind !== "group" ||
      chat.hostId !== userId ||
      participant.status !== "accepted"
    ) {
      throw new ChatError("not_allowed");
    }
    const title =
      input.title === undefined ? chat.title : cleanTitle(input.title);
    const renamed = title !== chat.title;
    const row = await db.transaction(async (tx: ContentDatabase) => {
      await tx
        .update(core_chat_conversations)
        .set({
          membersCanInvite: input.membersCanInvite ?? chat.membersCanInvite,
          title,
        })
        .where(eq(core_chat_conversations.id, chatId));

      return renamed
        ? await insertMessage(tx, {
            authorId: userId,
            chatId,
            system: { title, type: "renamed" },
          })
        : null;
    });
    if (row) await afterMessage(c, chat, row);
    const members = await activeMembers(c, chatId);
    pushChat(
      c,
      members.map(member => member.userId),
      { chatId, type: "chat" },
    );
  }

  if (input.mutedUntil !== undefined || input.hidden !== undefined) {
    const mutedUntil =
      input.mutedUntil === undefined
        ? participant.mutedUntil
        : input.mutedUntil
          ? new Date(input.mutedUntil)
          : null;
    if (mutedUntil && Number.isNaN(mutedUntil.getTime())) {
      throw new ChatError("invalid");
    }
    await db
      .update(core_chat_participants)
      .set({
        hiddenUntilMessageId:
          input.hidden === undefined
            ? participant.hiddenUntilMessageId
            : input.hidden
              ? (chat.lastMessageId ?? 0)
              : null,
        mutedUntil,
      })
      .where(
        and(
          eq(core_chat_participants.conversationId, chatId),
          eq(core_chat_participants.userId, userId),
        ),
      );
    pushChat(c, [userId], { chatId, type: "chat" });
    await pushChatState(c, [userId]);
  }
};

/** Adds people to a group chat; people with no chat with the inviter get a request. */
export const addChatMembers = async (
  c: Context,
  chatId: number,
  input: { userIds: number[] },
): Promise<void> => {
  const userId = requireUserId(c);
  const policy = await resolveChatPolicy(c);
  if (!policy.allowChat) throw new ChatError("not_allowed");
  const { chat, participant } = await requireMembership(c, chatId, userId);
  if (!c.get("core").chat.groups) throw new ChatError("groups_disabled");
  if (
    chat.kind !== "group" ||
    participant.status !== "accepted" ||
    (chat.hostId !== userId && !chat.membersCanInvite)
  ) {
    throw new ChatError("not_allowed");
  }
  const db = c.get("db");
  const current = await activeMembers(c, chatId);
  const currentIds = new Set(current.map(member => member.userId));
  const userIds = [...new Set(input.userIds)].filter(
    id => !currentIds.has(id) && id !== userId,
  );
  if (userIds.length === 0) return;
  if (policy.maxInvites !== null && userIds.length > policy.maxInvites) {
    throw new ChatError("too_many_invites");
  }
  if (current.length + userIds.length > c.get("core").chat.maxGroupSize) {
    throw new ChatError("group_full");
  }
  const checks = await checkChatRecipients(c, {
    policy,
    recipientIds: userIds,
    senderId: userId,
  });
  if (checks.some(check => !check.allowed)) {
    throw new ChatError("recipient_unavailable");
  }
  const pendingIds = checks.flatMap(check =>
    check.allowed && check.asRequest ? [check.userId] : [],
  );
  if (pendingIds.length > 0 && !policy.canMessageAnyone) {
    const until = await chatRequestsPausedUntil(c, userId);
    if (until) throw new ChatError("requests_paused", until);
  }

  const row = await db.transaction(async (tx: ContentDatabase) => {
    await lockChat(tx, chatId);
    const [fresh] = await tx
      .select({ lastMessageId: core_chat_conversations.lastMessageId })
      .from(core_chat_conversations)
      .where(eq(core_chat_conversations.id, chatId));
    const firstVisibleMessageId = (fresh?.lastMessageId ?? 0) + 1;
    for (const check of checks) {
      if (!check.allowed) continue;
      const values = {
        acceptedAt: check.asRequest ? null : new Date(),
        firstVisibleMessageId,
        hiddenUntilMessageId: null,
        invitedAt: new Date(),
        invitedById: userId,
        lastReadMessageId: 0,
        leftAt: null,
        mutedUntil: null,
        status: check.asRequest ? ("pending" as const) : ("accepted" as const),
      };
      await tx
        .insert(core_chat_participants)
        .values({ ...values, conversationId: chatId, userId: check.userId })
        .onConflictDoUpdate({
          set: values,
          target: [
            core_chat_participants.conversationId,
            core_chat_participants.userId,
          ],
        });
    }
    await recountMembers(tx, chatId);

    return await insertMessage(tx, {
      authorId: userId,
      chatId,
      system: { type: "joined", userIds },
    });
  });

  await c.get("events").emit(chatMemberAddedEvent, {
    addedById: userId,
    chatId,
    kind: chat.kind,
    userIds,
  });
  if (pendingIds.length > 0) {
    await c.get("notifications").publish({
      actorId: userId,
      data: { chatId, kind: chat.kind, title: chat.title },
      idempotencyKey: `chat-invite:${chatId}:${row.id}`,
      recipients: pendingIds,
      subject: { id: chatId, type: "core.chat" },
      type: chatRequestNotification,
    });
  }
  await afterMessage(c, chat, row);
  const members = await activeMembers(c, chatId);
  pushChat(
    c,
    members.map(member => member.userId),
    { chatId, type: "chat" },
  );
};

/**
 * Removes a member. Your own id leaves a group (or hides a direct chat);
 * the host may remove anyone else from a group.
 */
export const removeChatMember = async (
  c: Context,
  chatId: number,
  targetUserId: number,
): Promise<void> => {
  const userId = requireUserId(c);
  const { chat, participant } = await requireMembership(c, chatId, userId);
  const self = targetUserId === userId;
  if (chat.kind === "direct") {
    if (!self) throw new ChatError("not_allowed");
    await updateChat(c, chatId, { hidden: true });

    return;
  }
  if (!self && (chat.hostId !== userId || participant.status !== "accepted")) {
    throw new ChatError("not_allowed");
  }
  const db = c.get("db");
  const before = await activeMembers(c, chatId);
  if (!before.some(member => member.userId === targetUserId)) {
    throw new ChatError("not_found");
  }
  const row = await db.transaction(async (tx: ContentDatabase) => {
    await tx
      .update(core_chat_participants)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(core_chat_participants.conversationId, chatId),
          eq(core_chat_participants.userId, targetUserId),
        ),
      );
    await recountMembers(tx, chatId);
    if (chat.hostId === targetUserId) {
      const [next] = await tx
        .select({ userId: core_chat_participants.userId })
        .from(core_chat_participants)
        .where(
          and(
            eq(core_chat_participants.conversationId, chatId),
            eq(core_chat_participants.status, "accepted"),
            isNull(core_chat_participants.leftAt),
          ),
        )
        .orderBy(asc(core_chat_participants.invitedAt))
        .limit(1);
      await tx
        .update(core_chat_conversations)
        .set({ hostId: next?.userId ?? null })
        .where(eq(core_chat_conversations.id, chatId));
    }
    // A pending member who walks away leaves no trace for the others.
    if (participant.status === "pending" && self) return null;

    return await insertMessage(tx, {
      authorId: userId,
      chatId,
      system: self
        ? { type: "left" }
        : { type: "removed", userId: targetUserId },
    });
  });
  await c.get("events").emit(chatMemberRemovedEvent, {
    chatId,
    kind: chat.kind,
    reason: self ? "left" : "removed",
    userId: targetUserId,
  });
  if (row) await afterMessage(c, chat, row);
  pushChat(
    c,
    before.map(member => member.userId),
    { chatId, type: "chat" },
  );
  await pushChatState(c, [targetUserId]);
};

/** Relays "typing" to the other members who may see it. */
export const relayChatTyping = async (
  c: Context,
  chatId: number,
): Promise<void> => {
  const user = c.get("user");
  if (!user || !c.get("core").chat.enabled) return;
  const membership = await loadMembership(c, chatId, user.id);
  if (!membership || membership.participant.status !== "accepted") return;
  const members = await activeMembers(c, chatId);
  const me = members.find(member => member.userId === user.id);
  if (!me?.showReadReceipts) return;
  if (
    membership.chat.kind === "direct" &&
    members.some(member => member.status === "pending")
  ) {
    return;
  }
  const others = members
    .filter(member => member.userId !== user.id && member.status === "accepted")
    .map(member => member.userId);
  const blocks = await blockedBetween(c, user.id, others);
  pushChat(
    c,
    others.filter(
      id => !blocks.blockedByMe.has(id) && !blocks.blockedMe.has(id),
    ),
    { chatId, type: "typing", userId: user.id },
  );
};

/** Hides or shows a message for everyone, from a moderation report. */
export const setChatMessageHidden = async (
  tx: ContentDatabase,
  messageId: number,
  hidden: boolean,
): Promise<null | { changed: boolean; chatId: number }> => {
  const [row] = await tx
    .select({
      chatId: core_chat_messages.conversationId,
      hiddenByModeratorAt: core_chat_messages.hiddenByModeratorAt,
    })
    .from(core_chat_messages)
    .where(eq(core_chat_messages.id, messageId))
    .limit(1);
  if (!row) return null;
  if (!!row.hiddenByModeratorAt === hidden) {
    return { changed: false, chatId: row.chatId };
  }
  await tx
    .update(core_chat_messages)
    .set({ hiddenByModeratorAt: hidden ? new Date() : null })
    .where(eq(core_chat_messages.id, messageId));

  return { changed: true, chatId: row.chatId };
};

/** Pushes a message changed by a moderator to the members of its chat. */
export const pushModeratedMessage = async (
  c: Context,
  chatId: number,
  messageId: number,
): Promise<void> => {
  const [row] = await c
    .get("db")
    .select()
    .from(core_chat_messages)
    .where(eq(core_chat_messages.id, messageId))
    .limit(1);
  if (!row) return;
  const members = await activeMembers(c, chatId);
  const views = await Promise.all(
    members.map(async member => ({
      data: {
        chatId,
        message: (await toChatMessages(c, [row], member.userId))[0],
        type: "message_updated" as const,
      },
      userId: member.userId,
    })),
  );
  pushChatEach(c, views);
};

/** Ids of chats with no active member left, to delete. */
export const orphanChatIds = async (db: ContentDatabase): Promise<number[]> => {
  const rows = await db
    .select({ id: core_chat_conversations.id })
    .from(core_chat_conversations)
    .where(
      sql`not exists (select 1 from ${core_chat_participants} where ${core_chat_participants.conversationId} = ${core_chat_conversations.id} and ${core_chat_participants.leftAt} is null)`,
    );

  return rows.map(row => row.id);
};

/** Deletes chats by id (messages and reactions cascade). */
export const deleteChats = async (
  db: ContentDatabase,
  ids: readonly number[],
): Promise<void> => {
  if (ids.length === 0) return;
  await db
    .delete(core_chat_conversations)
    .where(inArray(core_chat_conversations.id, [...ids]));
};
