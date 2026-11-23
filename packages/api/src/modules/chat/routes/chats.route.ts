import { z } from "@hono/zod-openapi";
import { and, asc, eq, ilike, isNull, ne } from "drizzle-orm";

import { buildRoute } from "@/builders";
import {
  core_chat_conversations,
  core_chat_participants,
} from "@/database/chat";
import { core_users } from "@/database/users";
import {
  CHAT_LIMITS,
  CHAT_REQUESTS_FROM,
  chatDirectKey,
} from "@/lib/chat/const";
import { checkChatRecipients, resolveChatPolicy } from "@/lib/chat/policy";
import {
  listChats,
  loadMembership,
  readChatDetails,
  readChatState,
} from "@/lib/chat/read";
import {
  acceptChatRequest,
  ChatError,
  ignoreChatRequest,
  startChat,
  updateChat,
} from "@/lib/chat/service";
import { loadPublicPeople, zodPublicPerson } from "@/lib/public-people";
import { isWebSocketEnabled } from "@/ws/registry";

import {
  chatDetailsSchema,
  chatErrorJson,
  chatErrorResponses,
  chatListItemSchema,
  chatParams,
  chatStateSchema,
  clientIdSchema,
  json,
  messageBodySchema,
  privateHeaders,
  zodId,
} from "../chat.schema";

export const chatStateRoute = buildRoute({
  route: {
    method: "get",
    path: "/state",
    description:
      "The signed-in member's unread chats and pending chat requests, for the Chat button. Guests get zeros",
    responses: { 200: json(chatStateSchema, "Unread counts") },
  },
  handler: async c => {
    const user = c.get("user");
    const { enabled, groups } = c.get("core").chat;
    const policy = await resolveChatPolicy(c);
    const counts = user && enabled ? await readChatState(c, user.id) : null;

    return c.json(
      {
        enabled: enabled && policy.allowChat,
        groups,
        live: isWebSocketEnabled(),
        requests: counts?.requests ?? 0,
        unreadChats: counts?.unreadChats ?? 0,
      },
      200,
      privateHeaders,
    );
  },
});

export const listChatsRoute = buildRoute({
  route: {
    method: "get",
    path: "/",
    description:
      "One page of the signed-in member's chats, newest activity first. `filter=requests` lists chat requests and group invites",
    request: {
      query: z.object({
        cursor: zodId.optional(),
        filter: z.enum(["all", "unread", "requests"]).optional(),
      }),
    },
    responses: {
      200: json(
        z.object({
          items: z.array(chatListItemSchema),
          nextCursor: z.number().int().nullable(),
        }),
        "Chats",
      ),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user || !c.get("core").chat.enabled) {
      return chatErrorJson(c, new ChatError("not_found"));
    }
    const { cursor, filter } = c.req.valid("query");
    const page = await listChats(c, user.id, {
      cursor: cursor ? Number(cursor) : undefined,
      filter: filter ?? "all",
    });

    return c.json(page, 200, privateHeaders);
  },
});

export const startChatRoute = buildRoute({
  route: {
    method: "post",
    path: "/",
    description:
      "Start a chat. One person: a direct chat (or a message in the existing one). More: a group. People with no accepted chat with the sender get it as a chat request",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              body: messageBodySchema.optional(),
              clientId: clientIdSchema.optional(),
              title: z.string().max(CHAT_LIMITS.titleMaxLength).optional(),
              userIds: z.array(z.number().int().positive()).min(1).max(200),
            }),
          },
        },
      },
    },
    responses: {
      200: json(
        z.object({ chatId: z.number().int(), created: z.boolean() }),
        "The message went to an existing direct chat",
      ),
      201: json(
        z.object({ chatId: z.number().int(), created: z.boolean() }),
        "Chat created",
      ),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    try {
      const result = await startChat(c, c.req.valid("json"));

      return c.json(result, result.created ? 201 : 200, privateHeaders);
    } catch (error) {
      if (error instanceof ChatError) return chatErrorJson(c, error);
      throw error;
    }
  },
});

export const showChatRoute = buildRoute({
  route: {
    method: "get",
    path: "/{chatId}",
    description:
      "A chat's header - members, title, read state - and what the signed-in member may do in it",
    request: { params: chatParams },
    responses: {
      200: json(chatDetailsSchema, "The chat"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const user = c.get("user");
    const chatId = Number(c.req.valid("param").chatId);
    const membership =
      user && c.get("core").chat.enabled
        ? await loadMembership(c, chatId, user.id)
        : null;
    if (!user || !membership) {
      return chatErrorJson(c, new ChatError("not_found"));
    }

    return c.json(
      await readChatDetails(c, membership, user.id),
      200,
      privateHeaders,
    );
  },
});

export const updateChatRoute = buildRoute({
  route: {
    method: "patch",
    path: "/{chatId}",
    description:
      "Change a chat. The host of a group may rename it and allow members to invite; every member may mute or hide it for themselves",
    request: {
      params: chatParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              hidden: z.boolean().optional(),
              membersCanInvite: z.boolean().optional(),
              mutedUntil: z.iso.datetime().nullable().optional(),
              title: z
                .string()
                .max(CHAT_LIMITS.titleMaxLength)
                .nullable()
                .optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: json(z.object({ ok: z.boolean() }), "Saved"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    try {
      await updateChat(
        c,
        Number(c.req.valid("param").chatId),
        c.req.valid("json"),
      );

      return c.json({ ok: true }, 200, privateHeaders);
    } catch (error) {
      if (error instanceof ChatError) return chatErrorJson(c, error);
      throw error;
    }
  },
});

export const acceptChatRoute = buildRoute({
  route: {
    method: "post",
    path: "/{chatId}/accept",
    description: "Accept a chat request or a group invite",
    request: { params: chatParams },
    responses: {
      200: json(z.object({ ok: z.boolean() }), "Accepted"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    try {
      await acceptChatRequest(c, Number(c.req.valid("param").chatId));

      return c.json({ ok: true }, 200, privateHeaders);
    } catch (error) {
      if (error instanceof ChatError) return chatErrorJson(c, error);
      throw error;
    }
  },
});

export const ignoreChatRoute = buildRoute({
  route: {
    method: "post",
    path: "/{chatId}/ignore",
    description:
      "Ignore a chat request or a group invite. The sender is not told. `block` blocks them too",
    request: {
      params: chatParams,
      query: z.object({ block: z.enum(["true", "false"]).optional() }),
    },
    responses: {
      200: json(z.object({ ok: z.boolean() }), "Ignored"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    try {
      await ignoreChatRequest(c, Number(c.req.valid("param").chatId), {
        block: c.req.valid("query").block === "true",
      });

      return c.json({ ok: true }, 200, privateHeaders);
    } catch (error) {
      if (error instanceof ChatError) return chatErrorJson(c, error);
      throw error;
    }
  },
});

const settingsSchema = z.object({
  chatRequestsFrom: z.enum(CHAT_REQUESTS_FROM),
  showReadReceipts: z.boolean(),
});

export const showChatSettingsRoute = buildRoute({
  route: {
    method: "get",
    path: "/settings",
    description:
      "The signed-in member's chat settings: who may send them chat requests, and read receipts",
    responses: {
      200: json(settingsSchema, "Chat settings"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user || !c.get("core").chat.enabled) {
      return chatErrorJson(c, new ChatError("not_found"));
    }
    const [row] = await c
      .get("db")
      .select({
        chatRequestsFrom: core_users.chatRequestsFrom,
        showReadReceipts: core_users.showReadReceipts,
      })
      .from(core_users)
      .where(eq(core_users.id, user.id))
      .limit(1);

    return c.json(
      {
        chatRequestsFrom: row?.chatRequestsFrom ?? "everyone",
        showReadReceipts: row?.showReadReceipts ?? true,
      },
      200,
      privateHeaders,
    );
  },
});

export const updateChatSettingsRoute = buildRoute({
  route: {
    method: "put",
    path: "/settings",
    description: "Save the signed-in member's chat settings",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: settingsSchema } },
      },
    },
    responses: {
      200: json(settingsSchema, "Saved settings"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user || !c.get("core").chat.enabled) {
      return chatErrorJson(c, new ChatError("not_found"));
    }
    const settings = c.req.valid("json");
    await c
      .get("db")
      .update(core_users)
      .set(settings)
      .where(eq(core_users.id, user.id));

    return c.json(settings, 200, privateHeaders);
  },
});

export const canChatRoute = buildRoute({
  route: {
    method: "get",
    path: "/can-chat/{userId}",
    description:
      "Whether the signed-in member may chat with someone, whether it would be a chat request, and the existing direct chat with them",
    request: { params: z.object({ userId: zodId }) },
    responses: {
      200: json(
        z.object({
          allowed: z.boolean(),
          asRequest: z.boolean(),
          chatId: z.number().int().nullable(),
        }),
        "The answer",
      ),
    },
  },
  handler: async c => {
    const user = c.get("user");
    const userId = Number(c.req.valid("param").userId);
    const none = { allowed: false, asRequest: false, chatId: null };
    if (!user || user.id === userId || !c.get("core").chat.enabled) {
      return c.json(none, 200, privateHeaders);
    }
    const policy = await resolveChatPolicy(c);
    if (!policy.allowChat) return c.json(none, 200, privateHeaders);

    const [existing] = await c
      .get("db")
      .select({ id: core_chat_conversations.id })
      .from(core_chat_conversations)
      .innerJoin(
        core_chat_participants,
        and(
          eq(core_chat_participants.conversationId, core_chat_conversations.id),
          eq(core_chat_participants.userId, user.id),
          isNull(core_chat_participants.leftAt),
        ),
      )
      .where(
        eq(core_chat_conversations.directKey, chatDirectKey(user.id, userId)),
      )
      .limit(1);
    const [check] = await checkChatRecipients(c, {
      policy,
      recipientIds: [userId],
      senderId: user.id,
    });
    if (!check?.allowed) {
      return c.json(
        { ...none, chatId: existing?.id ?? null },
        200,
        privateHeaders,
      );
    }

    return c.json(
      {
        allowed: true,
        asRequest: !existing && check.asRequest,
        chatId: existing?.id ?? null,
      },
      200,
      privateHeaders,
    );
  },
});

const PEOPLE_LIMIT = 8;

export const searchPeopleRoute = buildRoute({
  route: {
    method: "get",
    path: "/people",
    description:
      "Members whose name starts with `q`, to pick chat recipients. Leaves out the signed-in member",
    request: {
      query: z.object({ q: z.string().trim().min(1).max(64) }),
    },
    responses: {
      200: json(z.object({ items: z.array(zodPublicPerson) }), "Members"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user || !c.get("core").chat.enabled) {
      return chatErrorJson(c, new ChatError("not_found"));
    }
    const q = c.req.valid("query").q.replace(/[\\%_]/gu, char => `\\${char}`);
    const rows = await c
      .get("db")
      .select({ id: core_users.id })
      .from(core_users)
      .where(and(ilike(core_users.name, `${q}%`), ne(core_users.id, user.id)))
      .orderBy(asc(core_users.name))
      .limit(PEOPLE_LIMIT);
    const people = await loadPublicPeople(
      c,
      rows.map(row => row.id),
    );

    return c.json(
      {
        items: rows.flatMap(row => {
          const person = people.get(row.id);

          return person ? [person] : [];
        }),
      },
      200,
      privateHeaders,
    );
  },
});
