import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import {
  CHAT_E2E,
  zodChatPublicKey,
  zodWrappedPrivateKey,
} from "@/lib/chat/e2e";
import { loadOwnKeys, loadPublicKeys, saveOwnKeys } from "@/lib/chat/keys";
import { resolveChatPolicy } from "@/lib/chat/policy";
import {
  ChatError,
  discloseChatMessages,
  rewrapChatKeys,
} from "@/lib/chat/service";

import {
  chatErrorJson,
  chatErrorResponses,
  chatParams,
  json,
  keyGrantsSchema,
  messageParams,
  privateHeaders,
} from "../chat.schema";

const ownKeysSchema = z.object({
  keyVersion: z.number().int(),
  passcodeKey: zodWrappedPrivateKey,
  publicKey: z.string(),
  recoveryKey: zodWrappedPrivateKey,
});

const notAvailable = (c: Parameters<typeof chatErrorJson>[0]) =>
  chatErrorJson(c, new ChatError("not_found"));

export const showOwnKeysRoute = buildRoute({
  route: {
    method: "get",
    path: "/keys/me",
    description:
      "The signed-in member's end-to-end encryption keys: the public key and the private key wrapped under their passcode and recovery key. Only the browser can unwrap them",
    responses: {
      200: json(
        z.object({
          keys: ownKeysSchema.nullable(),
          /** A role requires a passcode before chatting. */
          required: z.boolean(),
        }),
        "The member's keys, or `null` without a passcode",
      ),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user || !c.get("core").chat.enabled) return notAvailable(c);
    const [keys, policy] = await Promise.all([
      loadOwnKeys(c, user.id),
      resolveChatPolicy(c),
    ]);

    return c.json(
      {
        keys: keys
          ? {
              keyVersion: keys.keyVersion,
              passcodeKey: keys.passcodeKey,
              publicKey: keys.publicKey,
              recoveryKey: keys.recoveryKey,
            }
          : null,
        required: policy.forcePasscode,
      },
      200,
      privateHeaders,
    );
  },
});

export const saveOwnKeysRoute = buildRoute({
  route: {
    method: "put",
    path: "/keys/me",
    description:
      "Save the member's keys. `setup` the first time, `update` to re-wrap the same key pair under a new passcode or recovery key, `reset` to replace the pair after a forgotten passcode - encrypted chats then need another member to share their key again",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.discriminatedUnion("mode", [
              z.object({
                mode: z.enum(["setup", "reset"]),
                passcodeKey: zodWrappedPrivateKey,
                publicKey: zodChatPublicKey,
                recoveryKey: zodWrappedPrivateKey,
              }),
              z.object({
                mode: z.literal("update"),
                passcodeKey: zodWrappedPrivateKey.optional(),
                recoveryKey: zodWrappedPrivateKey.optional(),
              }),
            ]),
          },
        },
      },
    },
    responses: {
      200: json(z.object({ keyVersion: z.number().int() }), "Saved"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user || !c.get("core").chat.enabled) return notAvailable(c);
    const body = c.req.valid("json");
    if (
      "passcodeKey" in body &&
      body.passcodeKey &&
      (body.passcodeKey.iterations ?? 0) < CHAT_E2E.passcodeIterations
    ) {
      return chatErrorJson(c, new ChatError("invalid"));
    }
    const result = await saveOwnKeys(c, user.id, body);
    if ("error" in result) return chatErrorJson(c, new ChatError("invalid"));

    return c.json(result, 200, privateHeaders);
  },
});

export const listPublicKeysRoute = buildRoute({
  route: {
    method: "get",
    path: "/keys",
    description:
      "Public keys of members who set a chat passcode, to wrap a new encrypted chat's key for them. `userIds` is a comma-separated list",
    request: {
      query: z.object({
        userIds: z
          .string()
          .regex(/^\d{1,10}(,\d{1,10}){0,199}$/u)
          .openapi({ example: "2,3" }),
      }),
    },
    responses: {
      200: json(
        z.object({
          items: z.array(
            z.object({
              keyVersion: z.number().int(),
              publicKey: z.string(),
              userId: z.number().int(),
            }),
          ),
        }),
        "Keys of the members who have one",
      ),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user || !c.get("core").chat.enabled) return notAvailable(c);
    const ids = c.req.valid("query").userIds.split(",").map(Number);
    const keys = await loadPublicKeys(c, ids);

    return c.json(
      {
        items: [...keys].map(([userId, key]) => ({ ...key, userId })),
      },
      200,
      privateHeaders,
    );
  },
});

export const rewrapChatKeysRoute = buildRoute({
  route: {
    method: "put",
    path: "/{chatId}/keys",
    description:
      "Share an encrypted chat's key again with members who lost theirs (they reset their passcode). Only fills missing or outdated keys",
    request: {
      params: chatParams,
      body: {
        required: true,
        content: {
          "application/json": { schema: z.object({ keys: keyGrantsSchema }) },
        },
      },
    },
    responses: {
      200: json(z.object({ updated: z.number().int() }), "Keys stored"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    try {
      const result = await rewrapChatKeys(
        c,
        Number(c.req.valid("param").chatId),
        c.req.valid("json").keys,
      );

      return c.json(result, 200, privateHeaders);
    } catch (error) {
      if (error instanceof ChatError) return chatErrorJson(c, error);
      throw error;
    }
  },
});

export const discloseMessagesRoute = buildRoute({
  route: {
    method: "post",
    path: "/{chatId}/messages/{messageId}/disclose",
    description:
      "Before reporting a message from an encrypted chat, reveal its text (and up to 5 messages before it) to moderators. Every text must match the commitment stored when it was sent",
    request: {
      params: messageParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              messages: z
                .array(
                  z.object({
                    frankingKey: z.string().min(1).max(64),
                    messageId: z.number().int().positive(),
                    text: z.string().min(1).max(4000),
                  }),
                )
                .min(1)
                .max(6),
            }),
          },
        },
      },
    },
    responses: {
      200: json(z.object({ ok: z.boolean() }), "Stored for the report"),
      ...chatErrorResponses,
    },
  },
  handler: async c => {
    const params = c.req.valid("param");
    try {
      await discloseChatMessages(
        c,
        Number(params.chatId),
        Number(params.messageId),
        c.req.valid("json").messages,
      );

      return c.json({ ok: true }, 200, privateHeaders);
    } catch (error) {
      if (error instanceof ChatError) return chatErrorJson(c, error);
      throw error;
    }
  },
});
