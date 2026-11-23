import type { Context } from "hono";

import { z } from "@hono/zod-openapi";

import type { ChatError } from "@/lib/chat/service";
import type {
  ChatDetails,
  ChatListItem,
  ChatMessage,
  ChatState,
} from "@/lib/chat/types";

import {
  CHAT_KINDS,
  CHAT_LIMITS,
  CHAT_MEMBER_STATUSES,
  CHAT_MESSAGE_KINDS,
} from "@/lib/chat/const";
import { zodPublicPerson } from "@/lib/public-people";

export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});

export const chatErrorSchema = z
  .object({
    error: z.string(),
    /** When chat requests are paused: when they resume. */
    until: z.string().nullable(),
  })
  .openapi("ChatError");

/** Every error a chat write can answer with. */
export const chatErrorResponses = {
  400: json(chatErrorSchema, "Invalid input (`invalid`, `too_many_invites`)"),
  403: json(
    chatErrorSchema,
    "Not allowed (`not_allowed`, `blocked`, `recipient_unavailable`, `edit_window`)",
  ),
  404: json(
    chatErrorSchema,
    "Not a member of the chat, unknown message, or chat is off (`not_found`, `chat_disabled`)",
  ),
  409: json(chatErrorSchema, "`group_full` or `too_many_reactions`"),
  429: json(
    chatErrorSchema,
    "A limit is used up (`daily_limit`, `request_limit`, `requests_paused`)",
  ),
};

/** Answers a {@link ChatError} with its status and code. */
export const chatErrorJson = (c: Context, error: ChatError) => {
  const payload = {
    error: error.code,
    until: error.until?.toISOString() ?? null,
  };
  switch (error.status) {
    case 400:
      return c.json(payload, 400);
    case 403:
      return c.json(payload, 403);
    case 409:
      return c.json(payload, 409);
    case 429:
      return c.json(payload, 429);
    default:
      return c.json(payload, 404);
  }
};

export const zodId = z
  .string()
  .regex(/^[1-9]\d{0,15}$/u)
  .openapi({ example: "1" });

export const chatParams = z.object({ chatId: zodId });
export const messageParams = z.object({ chatId: zodId, messageId: zodId });

const systemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("created") }),
  z.object({ type: z.literal("joined"), userIds: z.array(z.number().int()) }),
  z.object({ type: z.literal("left") }),
  z.object({ type: z.literal("removed"), userId: z.number().int() }),
  z.object({ title: z.string().nullable(), type: z.literal("renamed") }),
]);

export const reactionSummarySchema = z.object({
  count: z.number().int(),
  emoji: z.string(),
  reacted: z.boolean(),
});

export const chatMessageSchema = z
  .object({
    author: zodPublicPerson.nullable(),
    body: z.string().nullable(),
    chatId: z.number().int(),
    clientId: z.string().nullable(),
    createdAt: z.string(),
    deleted: z.boolean(),
    editedAt: z.string().nullable(),
    hidden: z.boolean(),
    id: z.number().int(),
    kind: z.enum(CHAT_MESSAGE_KINDS),
    reactions: z.array(reactionSummarySchema),
    replyTo: z
      .object({
        author: zodPublicPerson.nullable(),
        deleted: z.boolean(),
        id: z.number().int(),
        text: z.string().nullable(),
      })
      .nullable(),
    sentAsRequest: z.boolean(),
    system: systemSchema.nullable(),
  })
  .openapi("ChatMessage") satisfies z.ZodType<ChatMessage>;

export const chatListItemSchema = z
  .object({
    id: z.number().int(),
    invitedBy: zodPublicPerson.nullable(),
    kind: z.enum(CHAT_KINDS),
    lastMessage: z
      .object({
        authorId: z.number().int().nullable(),
        authorName: z.string().nullable(),
        createdAt: z.string(),
        id: z.number().int(),
        preview: z.string().nullable(),
        system: systemSchema.nullable(),
      })
      .nullable(),
    members: z.array(zodPublicPerson),
    membersCount: z.number().int(),
    muted: z.boolean(),
    status: z.enum(CHAT_MEMBER_STATUSES),
    title: z.string().nullable(),
    unread: z.boolean(),
  })
  .openapi("ChatListItem") satisfies z.ZodType<ChatListItem>;

export const chatDetailsSchema = z
  .object({
    createdAt: z.string(),
    hostId: z.number().int().nullable(),
    id: z.number().int(),
    kind: z.enum(CHAT_KINDS),
    lastMessageId: z.number().int().nullable(),
    members: z.array(
      z.object({
        isHost: z.boolean(),
        lastReadMessageId: z.number().int().nullable(),
        status: z.enum(CHAT_MEMBER_STATUSES),
        user: zodPublicPerson,
      }),
    ),
    membersCanInvite: z.boolean(),
    membersCount: z.number().int(),
    me: z.object({
      blockedOther: z.boolean(),
      canInvite: z.boolean(),
      canManage: z.boolean(),
      canWrite: z.boolean(),
      invitedBy: zodPublicPerson.nullable(),
      lastReadMessageId: z.number().int(),
      mutedUntil: z.string().nullable(),
      pendingMessagesLeft: z.number().int().nullable(),
      status: z.enum(CHAT_MEMBER_STATUSES),
      waitingForAccept: z.boolean(),
    }),
    title: z.string().nullable(),
  })
  .openapi("ChatDetails") satisfies z.ZodType<ChatDetails>;

export const chatStateSchema = z
  .object({
    enabled: z.boolean(),
    live: z.boolean(),
    requests: z.number().int(),
    unreadChats: z.number().int(),
  })
  .openapi("ChatState") satisfies z.ZodType<ChatState>;

export const messageBodySchema = z
  .string()
  .min(1)
  .max(CHAT_LIMITS.messageMaxLength);

export const clientIdSchema = z.string().min(1).max(64);

/** `Cache-Control` for every chat answer: per member, never shared. */
export const privateHeaders = { "Cache-Control": "private, no-store" };
