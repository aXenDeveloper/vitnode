import type { Context } from "hono";

import { and, eq, gte, inArray, or, sql } from "drizzle-orm";

import {
  core_chat_conversations,
  core_chat_participants,
  core_chat_request_outcomes,
  core_users_blocks,
} from "@/database/chat";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import {
  checkStaffPermission,
  getUserRoleIds,
} from "@/lib/check-staff-permission";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { mostGenerousLimit } from "@/lib/reactions/policy";
import { staffPermissionArgs } from "@/lib/staff-permissions";

import { CHAT_LIMITS, chatDirectKey } from "./const";

/** What a member may do in chat, from all their roles. */
export interface ChatPolicy {
  /** One of their roles allows chat. Guests and suspended members never. */
  allowChat: boolean;
  /** Staff who skip requests, `nobody` and blocks (moderator permission). */
  canMessageAnyone: boolean;
  /**
   * A role requires a chat passcode: the member sets one before chatting,
   * and every chat they start is end-to-end encrypted. Any role forcing it
   * is enough - it's a protection, not a limit.
   */
  forcePasscode: boolean;
  /** People added to a group at once; `null` = up to the group cap. */
  maxInvites: null | number;
  /** New chats started per 24 hours; `null` = unlimited. */
  requestsPerDay: null | number;
}

const NO_CHAT: ChatPolicy = {
  allowChat: false,
  canMessageAnyone: false,
  forcePasscode: false,
  maxInvites: 0,
  requestsPerDay: 0,
};

const resolved = new WeakMap<Context, Promise<ChatPolicy>>();

const readPolicy = async (c: Context): Promise<ChatPolicy> => {
  const user = c.get("user");
  if (!user) return NO_CHAT;

  const roleIds = await getUserRoleIds(c, user);
  const roles = await c
    .get("db")
    .select({
      allowChat: core_roles.allowChat,
      chatForcePasscode: core_roles.chatForcePasscode,
      chatMaxInvites: core_roles.chatMaxInvites,
      chatRequestsPerDay: core_roles.chatRequestsPerDay,
    })
    .from(core_roles)
    .where(inArray(core_roles.id, roleIds));
  const chatting = roles.filter(role => role.allowChat);
  if (chatting.length === 0) return NO_CHAT;

  const canMessageAnyone = await checkStaffPermission(c, {
    ...staffPermissionArgs(
      coreStaffPermissions.moderator.users.canMessageAnyone,
    ),
    type: "moderator",
  });

  return {
    allowChat: true,
    canMessageAnyone,
    forcePasscode: roles.some(role => role.chatForcePasscode),
    maxInvites: mostGenerousLimit(chatting.map(role => role.chatMaxInvites)),
    requestsPerDay: mostGenerousLimit(
      chatting.map(role => role.chatRequestsPerDay),
    ),
  };
};

/** The signed-in member's chat policy, read once per request. Server-only. */
export const resolveChatPolicy = async (c: Context): Promise<ChatPolicy> => {
  const cached = resolved.get(c);
  if (cached) return await cached;

  const policy = readPolicy(c);
  resolved.set(c, policy);

  return await policy;
};

/** Ids among `others` that `userId` blocked or that blocked `userId`. */
export const blockedBetween = async (
  c: Context,
  userId: number,
  others: readonly number[],
): Promise<{ blockedByMe: Set<number>; blockedMe: Set<number> }> => {
  if (others.length === 0) {
    return { blockedByMe: new Set(), blockedMe: new Set() };
  }
  const rows = await c
    .get("db")
    .select({
      blockedUserId: core_users_blocks.blockedUserId,
      userId: core_users_blocks.userId,
    })
    .from(core_users_blocks)
    .where(
      or(
        and(
          eq(core_users_blocks.userId, userId),
          inArray(core_users_blocks.blockedUserId, [...others]),
        ),
        and(
          eq(core_users_blocks.blockedUserId, userId),
          inArray(core_users_blocks.userId, [...others]),
        ),
      ),
    );

  return {
    blockedByMe: new Set(
      rows.filter(row => row.userId === userId).map(row => row.blockedUserId),
    ),
    blockedMe: new Set(
      rows.filter(row => row.blockedUserId === userId).map(row => row.userId),
    ),
  };
};

/** Recipients who already have an accepted direct chat with `userId`. */
const acceptedDirectPartners = async (
  c: Context,
  userId: number,
  others: readonly number[],
): Promise<Set<number>> => {
  if (others.length === 0) return new Set();
  const keys = others.flatMap(other => [
    chatDirectKey(userId, other),
    chatDirectKey(userId, other, true),
  ]);
  const rows = await c
    .get("db")
    .select({
      directKey: core_chat_conversations.directKey,
      pending: sql<string>`count(*) filter (where ${core_chat_participants.status} = 'pending')`,
    })
    .from(core_chat_conversations)
    .innerJoin(
      core_chat_participants,
      eq(core_chat_participants.conversationId, core_chat_conversations.id),
    )
    .where(inArray(core_chat_conversations.directKey, keys))
    .groupBy(core_chat_conversations.directKey);

  const accepted = new Set(
    rows.filter(row => Number(row.pending) === 0).map(row => row.directKey),
  );

  return new Set(
    others.filter(
      other =>
        accepted.has(chatDirectKey(userId, other)) ||
        accepted.has(chatDirectKey(userId, other, true)),
    ),
  );
};

/** Why a member can't be messaged; one code for every reason on purpose. */
export type ChatRecipientCheck =
  | { allowed: false; userId: number }
  | { allowed: true; asRequest: boolean; userId: number };

/**
 * Whether `sender` may start a chat with (or add to a group) each of
 * `recipientIds`, and whether it lands as a request. Deleted members, members
 * who chose `nobody` or `established` (for a young account) and blocks in
 * either direction say no - except for staff with `can_message_anyone`.
 */
export const checkChatRecipients = async (
  c: Context,
  {
    policy,
    recipientIds,
    senderId,
  }: { policy: ChatPolicy; recipientIds: readonly number[]; senderId: number },
): Promise<ChatRecipientCheck[]> => {
  const db = c.get("db");
  const ids = [...new Set(recipientIds)].filter(id => id !== senderId);
  if (ids.length === 0) return [];

  const [recipients, [sender], blocks, partners] = await Promise.all([
    db
      .select({
        chatRequestsFrom: core_users.chatRequestsFrom,
        id: core_users.id,
      })
      .from(core_users)
      .where(inArray(core_users.id, ids)),
    db
      .select({ createdAt: core_users.createdAt })
      .from(core_users)
      .where(eq(core_users.id, senderId))
      .limit(1),
    blockedBetween(c, senderId, ids),
    acceptedDirectPartners(c, senderId, ids),
  ]);
  const settings = new Map(
    recipients.map(row => [row.id, row.chatRequestsFrom]),
  );
  const { establishedAccountDays } = c.get("core").chat;
  const established =
    !!sender &&
    Date.now() - sender.createdAt.getTime() >=
      establishedAccountDays * 24 * 60 * 60 * 1000;

  return ids.map(userId => {
    const from = settings.get(userId);
    if (!from) return { allowed: false, userId };
    if (policy.canMessageAnyone) {
      return { allowed: true, asRequest: false, userId };
    }
    if (blocks.blockedByMe.has(userId) || blocks.blockedMe.has(userId)) {
      return { allowed: false, userId };
    }
    if (partners.has(userId))
      return { allowed: true, asRequest: false, userId };
    if (from === "nobody") return { allowed: false, userId };
    if (from === "established" && !established) {
      return { allowed: false, userId };
    }

    return { allowed: true, asRequest: true, userId };
  });
};

/**
 * When the sender's chat requests are paused by the spam throttle, or
 * `null`: within the window, at least `throttleMinRequests` requests and
 * `throttleRatio` of them ignored or blocked.
 */
export const chatRequestsPausedUntil = async (
  c: Context,
  senderId: number,
): Promise<Date | null> => {
  const since = new Date(
    Date.now() - CHAT_LIMITS.throttleWindowDays * 24 * 60 * 60 * 1000,
  );
  const [row] = await c
    .get("db")
    .select({
      lastNegative: sql<
        null | string
      >`max(${core_chat_request_outcomes.createdAt}) filter (where ${core_chat_request_outcomes.outcome} <> 'accepted')`,
      negative: sql<string>`count(*) filter (where ${core_chat_request_outcomes.outcome} <> 'accepted')`,
      total: sql<string>`count(*)`,
    })
    .from(core_chat_request_outcomes)
    .where(
      and(
        eq(core_chat_request_outcomes.senderId, senderId),
        gte(core_chat_request_outcomes.createdAt, since),
      ),
    );
  const total = Number(row?.total ?? 0);
  const negative = Number(row?.negative ?? 0);
  if (
    !row?.lastNegative ||
    total < CHAT_LIMITS.throttleMinRequests ||
    negative / total < CHAT_LIMITS.throttleRatio
  ) {
    return null;
  }
  const until = new Date(
    new Date(row.lastNegative).getTime() +
      CHAT_LIMITS.throttlePauseHours * 60 * 60 * 1000,
  );

  return until.getTime() > Date.now() ? until : null;
};

/** New chats `userId` started in the last 24 hours. */
export const chatsStartedToday = async (
  c: Context,
  userId: number,
): Promise<number> => {
  const [row] = await c
    .get("db")
    .select({ count: sql<string>`count(*)` })
    .from(core_chat_conversations)
    .where(
      and(
        eq(core_chat_conversations.hostId, userId),
        gte(
          core_chat_conversations.createdAt,
          new Date(Date.now() - 24 * 60 * 60 * 1000),
        ),
      ),
    );

  return Number(row?.count ?? 0);
};
