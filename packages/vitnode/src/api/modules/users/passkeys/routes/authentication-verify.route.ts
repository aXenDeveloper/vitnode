import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import {
  EMAIL_NOT_VERIFIED,
  mustVerifyEmail,
} from "@/api/models/email-verification";
import { PasskeyError, PasskeyModel } from "@/api/models/passkey";
import { SessionModel } from "@/api/models/session";
import { CONFIG_PLUGIN } from "@/config";
import { core_users } from "@/database/users";

import { passkeyFailure } from "../failure";
import {
  PASSKEY_ERROR_RESPONSES,
  zodPasskeyAuthenticationResponseSchema,
} from "../schema";

export const passkeyAuthenticationVerifyRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Finish signing in with a passkey and start a normal session. Never starts an AdminCP session.",
    path: "/sign-in",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              response: zodPasskeyAuthenticationResponseSchema,
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({ id: z.number() }),
          },
        },
        description: "Signed in",
      },
      ...PASSKEY_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const { response } = c.req.valid("json");

    try {
      const { userId } = await new PasskeyModel(c).verifyAuthentication(
        response,
        "authentication",
      );
      const [user] = await c
        .get("db")
        .select({ emailVerified: core_users.emailVerified })
        .from(core_users)
        .where(eq(core_users.id, userId))
        .limit(1);
      if (user && mustVerifyEmail(c, user)) {
        throw new PasskeyError(EMAIL_NOT_VERIFIED, 403);
      }

      await new SessionModel(c).createSessionByUserId(userId);

      return c.json({ id: userId }, 201);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
