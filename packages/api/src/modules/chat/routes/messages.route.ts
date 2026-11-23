import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { CHAT_LIMITS } from "@/lib/chat/const";
import { canReadMessages, listMessages, loadMembership } from "@/lib/chat/read";
import {
  addChatMembers,
  ChatError,
  deleteChatMessage,
  editChatMessage,
  markChatRead,
  removeChatMember,
  sendChatMessage,
  setChatReaction,
} from "@/lib/chat/service";

import {
  chatErrorJson,
  chatErrorResponses,
  chatMessageSchema,
  chatParams,
  clientIdSchema,
  json,
  messageBodySchema,
  messageParams,
  privateHeaders,
  reactionSummarySchema,
  zodId,
} from "../chat.schema";

const rethrow = (c: Parameters<typeof chatErrorJson>[0], error: unknown) => {
  if (error instanceof ChatError) return chatErrorJson(c, error);
  throw error;
};

export const listMessagesRoute = buildRoute({
  route: {
    method: "get",
    path: "/{chatId}/messages",
    description:
      "A page of a chat's messages, oldest first. `before` pages back, `after` forward and `around` centres on one message. A pending group invite lists none",
    request: {
      params: chatParams,
      query: z.object({
        after: zodId.optional(),
        around: zodId.optional(),
        before: zodId.optional(),
        limit: z
          .string()
          .regex(/^\d{1,3}$/u)
          .optional(),
      }),
    },
    responses: {
      200: json(
        z.object({
          hasNewer: z.boolean(),
          hasOlder: z.boolean(),
          items: z.array(chatMessageSchema),
        }),
        "Messages",
      ),
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
    if (!canReadMessages(membership)) {
      return c.json(
        { hasNewer: false, hasOlder: false, items: [] },
        200,
        privateHeaders,
      );
    }
    const query = c.req.valid("query");
    const limit = Math.min(
      Math.max(Number(query.limit ?? CHAT_LIMITS.pageSize), 1),
      CHAT_LIMITS.pageMaxSize,
    );
    const page = await listMessages(c, membership, user.id, {
      after: query.after ? Number(query.after) : undefined,
      around: query.around ? Number(query.around) : undefined,
      before: query.before ? Number(query.before) : undefined,
      limit,
    });

    return c.json(page, 200, privateHeaders);
  },
});

export const sendMessageRoute = buildRoute({
  route: {
    method: "post",
    path: "/{chatId}/messages",
    description:
      "Send a message. The same `clientId` again returns the stored message, so retries are safe. Replying to a chat request accepts it",
    request: {
      params: chatParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              body: messageBodySchema,
              clientId: clientIdSchema.optional(),
              replyToMessageId: z.number().int().positive().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: json(chatMessageSchema, "The message"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    try {
      const message = await sendChatMessage(
        c,
        Number(c.req.valid("param").chatId),
        c.req.valid("json"),
      );

      return c.json(message, 201, privateHeaders);
    } catch (error) {
      return rethrow(c, error);
    }
  },
});

export const editMessageRoute = buildRoute({
  route: {
    method: "patch",
    path: "/{chatId}/messages/{messageId}",
    description: "Edit your own message within the edit window",
    request: {
      params: messageParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ body: messageBodySchema }),
          },
        },
      },
    },
    responses: {
      200: json(chatMessageSchema, "The edited message"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const params = c.req.valid("param");
    try {
      const message = await editChatMessage(
        c,
        Number(params.chatId),
        Number(params.messageId),
        c.req.valid("json"),
      );

      return c.json(message, 200, privateHeaders);
    } catch (error) {
      return rethrow(c, error);
    }
  },
});

export const deleteMessageRoute = buildRoute({
  route: {
    method: "delete",
    path: "/{chatId}/messages/{messageId}",
    description:
      "Delete your own message. It stays as a 'Message deleted' line so replies keep their context",
    request: { params: messageParams },
    responses: {
      200: json(z.object({ ok: z.boolean() }), "Deleted"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const params = c.req.valid("param");
    try {
      await deleteChatMessage(
        c,
        Number(params.chatId),
        Number(params.messageId),
      );

      return c.json({ ok: true }, 200, privateHeaders);
    } catch (error) {
      return rethrow(c, error);
    }
  },
});

const reactionParams = messageParams.extend({
  emoji: z.string().min(1).max(64),
});

const reactionResponses = {
  200: json(
    z.object({ reactions: z.array(reactionSummarySchema) }),
    "The message's reactions",
  ),
  ...chatErrorResponses,
};

export const addReactionRoute = buildRoute({
  route: {
    method: "put",
    path: "/{chatId}/messages/{messageId}/reactions/{emoji}",
    description: "Add your emoji reaction to a message (URL-encoded emoji)",
    request: { params: reactionParams },
    responses: reactionResponses,
  },
  handler: async c => {
    const params = c.req.valid("param");
    try {
      const reactions = await setChatReaction(
        c,
        Number(params.chatId),
        Number(params.messageId),
        decodeURIComponent(params.emoji),
        true,
      );

      return c.json({ reactions }, 200, privateHeaders);
    } catch (error) {
      return rethrow(c, error);
    }
  },
});

export const removeReactionRoute = buildRoute({
  route: {
    method: "delete",
    path: "/{chatId}/messages/{messageId}/reactions/{emoji}",
    description: "Remove your emoji reaction from a message",
    request: { params: reactionParams },
    responses: reactionResponses,
  },
  handler: async c => {
    const params = c.req.valid("param");
    try {
      const reactions = await setChatReaction(
        c,
        Number(params.chatId),
        Number(params.messageId),
        decodeURIComponent(params.emoji),
        false,
      );

      return c.json({ reactions }, 200, privateHeaders);
    } catch (error) {
      return rethrow(c, error);
    }
  },
});

export const markReadRoute = buildRoute({
  route: {
    method: "post",
    path: "/{chatId}/read",
    description: "Move your read position forward to `messageId`",
    request: {
      params: chatParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ messageId: z.number().int().positive() }),
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
      await markChatRead(
        c,
        Number(c.req.valid("param").chatId),
        c.req.valid("json").messageId,
      );

      return c.json({ ok: true }, 200, privateHeaders);
    } catch (error) {
      return rethrow(c, error);
    }
  },
});

export const addMembersRoute = buildRoute({
  route: {
    method: "post",
    path: "/{chatId}/members",
    description:
      "Add people to a group chat. People with no accepted chat with you get a group invite to accept first",
    request: {
      params: chatParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              userIds: z.array(z.number().int().positive()).min(1).max(200),
            }),
          },
        },
      },
    },
    responses: {
      200: json(z.object({ ok: z.boolean() }), "Added"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    try {
      await addChatMembers(
        c,
        Number(c.req.valid("param").chatId),
        c.req.valid("json"),
      );

      return c.json({ ok: true }, 200, privateHeaders);
    } catch (error) {
      return rethrow(c, error);
    }
  },
});

export const removeMemberRoute = buildRoute({
  route: {
    method: "delete",
    path: "/{chatId}/members/{userId}",
    description:
      "Your own id leaves a group (or hides a direct chat); the host may remove anyone else from a group",
    request: { params: chatParams.extend({ userId: zodId }) },
    responses: {
      200: json(z.object({ ok: z.boolean() }), "Removed"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const params = c.req.valid("param");
    try {
      await removeChatMember(c, Number(params.chatId), Number(params.userId));

      return c.json({ ok: true }, 200, privateHeaders);
    } catch (error) {
      return rethrow(c, error);
    }
  },
});
