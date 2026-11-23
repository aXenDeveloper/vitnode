import type { Context } from "hono";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  sql,
} from "drizzle-orm";

import type { ContentPublicPerson } from "@/content/public-person";

import {
  core_chat_conversations,
  core_chat_message_reactions,
  core_chat_messages,
  core_chat_participants,
} from "@/database/chat";
import { core_users } from "@/database/users";
import { loadPublicPeople } from "@/lib/public-people";

import type {
  ChatDetails,
  ChatListItem,
  ChatMessage,
  ChatReactionSummary,
} from "./types";

import { CHAT_LIMITS } from "./const";
import { chatMessagePlainText } from "./format";
import { blockedBetween, resolveChatPolicy } from "./policy";

export type ChatParticipantRow = typeof core_chat_participants.$inferSelect;
export type ChatConversationRow = typeof core_chat_conversations.$inferSelect;
export type ChatMessageRow = typeof core_chat_messages.$inferSelect;

/** A member's row with its chat, or `null` when they are not in it. */
export interface ChatMembership {
  chat: ChatConversationRow;
  participant: ChatParticipantRow;
}

/** The viewer's active membership of `chatId` (left members get `null`). */
export const loadMembership = async (
  c: Context,
  chatId: number,
  userId: number,
): Promise<ChatMembership | null> => {
  const [row] = await c
    .get("db")
    .select({
      chat: core_chat_conversations,
      participant: core_chat_participants,
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

  return row ?? null;
};

/** A pending group member sees the invite, not the messages. */
export const canReadMessages = ({ chat, participant }: ChatMembership) =>
  participant.status === "accepted" || chat.kind === "direct";

const isMuted = (participant: Pick<ChatParticipantRow, "mutedUntil">) =>
  !!participant.mutedUntil && participant.mutedUntil.getTime() > Date.now();

const unreadSql = sql`${core_chat_conversations.lastMessageId} > ${core_chat_participants.lastReadMessageId}`;
const notHiddenSql = sql`(${core_chat_participants.hiddenUntilMessageId} IS NULL OR ${core_chat_conversations.lastMessageId} > ${core_chat_participants.hiddenUntilMessageId})`;

/** The numbers on the Chat button. */
export const readChatState = async (
  c: Context,
  userId: number,
): Promise<{ requests: number; unreadChats: number }> => {
  const [row] = await c
    .get("db")
    .select({
      requests: sql<string>`count(*) filter (where ${core_chat_participants.status} = 'pending')`,
      unreadChats: sql<string>`count(*) filter (where ${core_chat_participants.status} = 'accepted' AND ${unreadSql} AND (${core_chat_participants.mutedUntil} IS NULL OR ${core_chat_participants.mutedUntil} < now()))`,
    })
    .from(core_chat_participants)
    .innerJoin(
      core_chat_conversations,
      eq(core_chat_conversations.id, core_chat_participants.conversationId),
    )
    .where(
      and(
        eq(core_chat_participants.userId, userId),
        isNull(core_chat_participants.leftAt),
        notHiddenSql,
      ),
    );

  return {
    requests: Number(row?.requests ?? 0),
    unreadChats: Number(row?.unreadChats ?? 0),
  };
};

/** Up to `perChat` active members of each chat other than `viewerId`. */
const otherMembers = async (
  c: Context,
  chatIds: readonly number[],
  viewerId: number,
  perChat = 3,
): Promise<Map<number, number[]>> => {
  if (chatIds.length === 0) return new Map();
  const rows = await c
    .get("db")
    .select({
      chatId: core_chat_participants.conversationId,
      userId: core_chat_participants.userId,
    })
    .from(core_chat_participants)
    .where(
      and(
        inArray(core_chat_participants.conversationId, [...chatIds]),
        ne(core_chat_participants.userId, viewerId),
        isNull(core_chat_participants.leftAt),
      ),
    )
    .orderBy(asc(core_chat_participants.invitedAt));
  const map = new Map<number, number[]>();
  for (const row of rows) {
    const list = map.get(row.chatId) ?? [];
    if (list.length < perChat) list.push(row.userId);
    map.set(row.chatId, list);
  }

  return map;
};

const previewOf = (
  message: Pick<
    ChatMessageRow,
    "body" | "deletedAt" | "hiddenByModeratorAt" | "sentAsRequest"
  >,
): null | string => {
  if (message.deletedAt || message.hiddenByModeratorAt || !message.body) {
    return null;
  }

  return chatMessagePlainText(message.body, CHAT_LIMITS.previewLength);
};

/**
 * One page of the viewer's chats, newest activity first. `cursor` is the
 * last row's `lastMessage.id` - message ids grow across every chat.
 */
export const listChats = async (
  c: Context,
  viewerId: number,
  {
    cursor,
    filter,
  }: { cursor?: number; filter: "all" | "requests" | "unread" },
): Promise<{ items: ChatListItem[]; nextCursor: null | number }> => {
  const db = c.get("db");
  const limit = CHAT_LIMITS.listPageSize;
  const rows = await db
    .select({
      chat: core_chat_conversations,
      participant: core_chat_participants,
    })
    .from(core_chat_participants)
    .innerJoin(
      core_chat_conversations,
      eq(core_chat_conversations.id, core_chat_participants.conversationId),
    )
    .where(
      and(
        eq(core_chat_participants.userId, viewerId),
        isNull(core_chat_participants.leftAt),
        notHiddenSql,
        filter === "requests"
          ? eq(core_chat_participants.status, "pending")
          : eq(core_chat_participants.status, "accepted"),
        filter === "unread" ? unreadSql : undefined,
        cursor ? lt(core_chat_conversations.lastMessageId, cursor) : undefined,
      ),
    )
    .orderBy(desc(core_chat_conversations.lastMessageId))
    .limit(limit + 1);
  const page = rows.slice(0, limit);

  const lastIds = page.flatMap(row =>
    row.chat.lastMessageId ? [row.chat.lastMessageId] : [],
  );
  const lastMessages =
    lastIds.length === 0
      ? []
      : await db
          .select()
          .from(core_chat_messages)
          .where(inArray(core_chat_messages.id, lastIds));
  const lastById = new Map(lastMessages.map(row => [row.id, row]));
  const members = await otherMembers(
    c,
    page.map(row => row.chat.id),
    viewerId,
  );
  const people = await loadPublicPeople(c, [
    ...[...members.values()].flat(),
    ...page.map(row => row.participant.invitedById),
    ...lastMessages.map(row => row.authorId),
  ]);

  const items = page.map(({ chat, participant }): ChatListItem => {
    const last = chat.lastMessageId ? lastById.get(chat.lastMessageId) : null;
    const pendingGroup =
      participant.status === "pending" && chat.kind === "group";

    return {
      id: chat.id,
      invitedBy:
        participant.status === "pending" && participant.invitedById
          ? (people.get(participant.invitedById) ?? null)
          : null,
      kind: chat.kind,
      lastMessage:
        last && !pendingGroup && last.id >= participant.firstVisibleMessageId
          ? {
              authorId: last.authorId,
              authorName: last.authorId
                ? (people.get(last.authorId)?.name ?? null)
                : null,
              createdAt: last.createdAt.toISOString(),
              id: last.id,
              preview: previewOf(last),
              system: last.system,
            }
          : null,
      members: (members.get(chat.id) ?? []).flatMap(id => {
        const person = people.get(id);

        return person ? [person] : [];
      }),
      membersCount: chat.membersCount,
      muted: isMuted(participant),
      status: participant.status,
      title: chat.title,
      unread:
        participant.status === "accepted" &&
        (chat.lastMessageId ?? 0) > participant.lastReadMessageId,
    };
  });

  return {
    items,
    nextCursor:
      rows.length > limit ? (page.at(-1)?.chat.lastMessageId ?? null) : null,
  };
};

/** Reaction summaries of `messageIds` as `viewerId` sees them. */
export const reactionSummaries = async (
  c: Context,
  messageIds: readonly number[],
  viewerId: number,
): Promise<Map<number, ChatReactionSummary[]>> => {
  if (messageIds.length === 0) return new Map();
  const rows = await c
    .get("db")
    .select({
      count: sql<string>`count(*)`,
      emoji: core_chat_message_reactions.emoji,
      first: sql<string>`min(${core_chat_message_reactions.createdAt})`,
      messageId: core_chat_message_reactions.messageId,
      reacted: sql<boolean>`bool_or(${core_chat_message_reactions.userId} = ${viewerId})`,
    })
    .from(core_chat_message_reactions)
    .where(inArray(core_chat_message_reactions.messageId, [...messageIds]))
    .groupBy(
      core_chat_message_reactions.messageId,
      core_chat_message_reactions.emoji,
    )
    .orderBy(sql`min(${core_chat_message_reactions.createdAt})`);
  const map = new Map<number, ChatReactionSummary[]>();
  for (const row of rows) {
    const list = map.get(row.messageId) ?? [];
    list.push({
      count: Number(row.count),
      emoji: row.emoji,
      reacted: row.reacted,
    });
    map.set(row.messageId, list);
  }

  return map;
};

/** Turns message rows into what a member sees, with authors, replies and reactions. */
export const toChatMessages = async (
  c: Context,
  rows: readonly ChatMessageRow[],
  viewerId: number,
  { withReactions = true }: { withReactions?: boolean } = {},
): Promise<ChatMessage[]> => {
  if (rows.length === 0) return [];
  const replyIds = [
    ...new Set(
      rows.flatMap(row => (row.replyToMessageId ? [row.replyToMessageId] : [])),
    ),
  ];
  const replies =
    replyIds.length === 0
      ? []
      : await c
          .get("db")
          .select()
          .from(core_chat_messages)
          .where(inArray(core_chat_messages.id, replyIds));
  const replyById = new Map(replies.map(row => [row.id, row]));
  const people = await loadPublicPeople(c, [
    ...rows.map(row => row.authorId),
    ...replies.map(row => row.authorId),
  ]);
  const reactions = withReactions
    ? await reactionSummaries(
        c,
        rows.map(row => row.id),
        viewerId,
      )
    : new Map<number, ChatReactionSummary[]>();
  const person = (id: null | number): ContentPublicPerson | null =>
    id ? (people.get(id) ?? null) : null;

  return rows.map(row => {
    const reply = row.replyToMessageId
      ? replyById.get(row.replyToMessageId)
      : undefined;
    const gone = !!row.deletedAt || !!row.hiddenByModeratorAt;

    return {
      author: person(row.authorId),
      body: gone ? null : row.body,
      chatId: row.conversationId,
      clientId: row.authorId === viewerId ? row.clientId : null,
      createdAt: row.createdAt.toISOString(),
      deleted: !!row.deletedAt,
      editedAt: row.editedAt?.toISOString() ?? null,
      hidden: !!row.hiddenByModeratorAt,
      id: row.id,
      kind: row.kind,
      reactions: gone ? [] : (reactions.get(row.id) ?? []),
      replyTo: row.replyToMessageId
        ? {
            author: person(reply?.authorId ?? null),
            deleted: !reply || !!reply.deletedAt || !!reply.hiddenByModeratorAt,
            id: row.replyToMessageId,
            text:
              reply &&
              !reply.deletedAt &&
              !reply.hiddenByModeratorAt &&
              reply.body
                ? chatMessagePlainText(
                    reply.body,
                    CHAT_LIMITS.replyPreviewLength,
                  )
                : null,
          }
        : null,
      sentAsRequest: row.sentAsRequest,
      system: row.system,
    };
  });
};

/**
 * A page of messages, oldest first. `before` pages back, `after` forward
 * and `around` centres on one message (for jumping to a reply).
 */
export const listMessages = async (
  c: Context,
  membership: ChatMembership,
  viewerId: number,
  {
    after,
    around,
    before,
    limit = CHAT_LIMITS.pageSize,
  }: { after?: number; around?: number; before?: number; limit?: number },
): Promise<{ hasNewer: boolean; hasOlder: boolean; items: ChatMessage[] }> => {
  const db = c.get("db");
  const base = and(
    eq(core_chat_messages.conversationId, membership.chat.id),
    gte(core_chat_messages.id, membership.participant.firstVisibleMessageId),
  );
  const older = (below: number | undefined, count: number, inclusive = false) =>
    db
      .select()
      .from(core_chat_messages)
      .where(
        and(
          base,
          below === undefined
            ? undefined
            : inclusive
              ? lte(core_chat_messages.id, below)
              : lt(core_chat_messages.id, below),
        ),
      )
      .orderBy(desc(core_chat_messages.id))
      .limit(count + 1);
  const newer = (above: number, count: number) =>
    db
      .select()
      .from(core_chat_messages)
      .where(and(base, gt(core_chat_messages.id, above)))
      .orderBy(asc(core_chat_messages.id))
      .limit(count + 1);

  let rows: ChatMessageRow[];
  let hasOlder = false;
  let hasNewer = false;
  if (after !== undefined) {
    const found = await newer(after, limit);
    hasNewer = found.length > limit;
    rows = found.slice(0, limit);
    hasOlder = true;
  } else if (around !== undefined) {
    const half = Math.floor(limit / 2);
    const [down, up] = await Promise.all([
      older(around, half, true),
      newer(around, half),
    ]);
    hasOlder = down.length > half;
    hasNewer = up.length > half;
    rows = [...down.slice(0, half).reverse(), ...up.slice(0, half)];
  } else {
    const found = await older(before, limit);
    hasOlder = found.length > limit;
    rows = found.slice(0, limit).reverse();
    hasNewer = before !== undefined;
  }

  return {
    hasNewer,
    hasOlder,
    items: await toChatMessages(c, rows, viewerId),
  };
};

/** The chat header as `viewerId` sees it. */
export const readChatDetails = async (
  c: Context,
  membership: ChatMembership,
  viewerId: number,
): Promise<ChatDetails> => {
  const db = c.get("db");
  const { chat, participant } = membership;
  const memberRows = await db
    .select({
      participant: core_chat_participants,
      showReadReceipts: core_users.showReadReceipts,
    })
    .from(core_chat_participants)
    .innerJoin(core_users, eq(core_users.id, core_chat_participants.userId))
    .where(
      and(
        eq(core_chat_participants.conversationId, chat.id),
        isNull(core_chat_participants.leftAt),
      ),
    )
    .orderBy(asc(core_chat_participants.invitedAt));
  const people = await loadPublicPeople(c, [
    ...memberRows.map(row => row.participant.userId),
    participant.invitedById,
  ]);
  const viewerReceipts =
    memberRows.find(row => row.participant.userId === viewerId)
      ?.showReadReceipts ?? false;
  const others = memberRows.filter(row => row.participant.userId !== viewerId);
  const policy = await resolveChatPolicy(c);
  const otherIds = others.map(row => row.participant.userId);
  const blocks =
    chat.kind === "direct"
      ? await blockedBetween(c, viewerId, otherIds)
      : { blockedByMe: new Set<number>(), blockedMe: new Set<number>() };
  const blockedDirect =
    chat.kind === "direct" &&
    !policy.canMessageAnyone &&
    otherIds.some(id => blocks.blockedByMe.has(id) || blocks.blockedMe.has(id));
  const waitingForAccept =
    chat.kind === "direct" &&
    participant.status === "accepted" &&
    others.some(row => row.participant.status === "pending");

  let pendingMessagesLeft: null | number = null;
  if (waitingForAccept) {
    const [sent] = await db
      .select({ count: sql<string>`count(*)` })
      .from(core_chat_messages)
      .where(
        and(
          eq(core_chat_messages.conversationId, chat.id),
          eq(core_chat_messages.authorId, viewerId),
          eq(core_chat_messages.sentAsRequest, true),
        ),
      );
    pendingMessagesLeft = Math.max(
      0,
      CHAT_LIMITS.pendingMessages - Number(sent?.count ?? 0),
    );
  }
  const isHost = chat.hostId === viewerId;
  const accepted = participant.status === "accepted";

  return {
    createdAt: chat.createdAt.toISOString(),
    hostId: chat.hostId,
    id: chat.id,
    kind: chat.kind,
    lastMessageId: chat.lastMessageId,
    members: memberRows.flatMap(row => {
      const user = people.get(row.participant.userId);
      if (!user) return [];

      return [
        {
          isHost: chat.hostId === row.participant.userId,
          lastReadMessageId:
            viewerReceipts && row.showReadReceipts
              ? row.participant.lastReadMessageId
              : null,
          status: row.participant.status,
          user,
        },
      ];
    }),
    membersCanInvite: chat.membersCanInvite,
    membersCount: chat.membersCount,
    me: {
      blockedOther: otherIds.some(id => blocks.blockedByMe.has(id)),
      canInvite:
        chat.kind === "group" &&
        accepted &&
        policy.allowChat &&
        (isHost || chat.membersCanInvite),
      canManage: chat.kind === "group" && accepted && isHost,
      canWrite:
        policy.allowChat &&
        !blockedDirect &&
        (chat.kind === "direct" || accepted) &&
        (pendingMessagesLeft === null || pendingMessagesLeft > 0),
      invitedBy: participant.invitedById
        ? (people.get(participant.invitedById) ?? null)
        : null,
      lastReadMessageId: participant.lastReadMessageId,
      mutedUntil: isMuted(participant)
        ? (participant.mutedUntil?.toISOString() ?? null)
        : null,
      pendingMessagesLeft,
      status: participant.status,
      waitingForAccept,
    },
    title: chat.title,
  };
};

/** Active members of a chat, with what the live channel needs. */
export const activeMembers = async (
  c: Context,
  chatId: number,
): Promise<
  {
    mutedUntil: Date | null;
    showReadReceipts: boolean;
    status: "accepted" | "pending";
    userId: number;
  }[]
> =>
  await c
    .get("db")
    .select({
      mutedUntil: core_chat_participants.mutedUntil,
      showReadReceipts: core_users.showReadReceipts,
      status: core_chat_participants.status,
      userId: core_chat_participants.userId,
    })
    .from(core_chat_participants)
    .innerJoin(core_users, eq(core_users.id, core_chat_participants.userId))
    .where(
      and(
        eq(core_chat_participants.conversationId, chatId),
        isNull(core_chat_participants.leftAt),
      ),
    );

/** The chat ids `userId` is an active member of, among `chatIds`. */
export const memberChatIds = async (
  c: Context,
  userId: number,
  chatIds: readonly number[],
): Promise<Set<number>> => {
  if (chatIds.length === 0) return new Set();
  const rows = await c
    .get("db")
    .select({ chatId: core_chat_participants.conversationId })
    .from(core_chat_participants)
    .where(
      and(
        eq(core_chat_participants.userId, userId),
        inArray(core_chat_participants.conversationId, [...chatIds]),
        isNull(core_chat_participants.leftAt),
      ),
    );

  return new Set(rows.map(row => row.chatId));
};
