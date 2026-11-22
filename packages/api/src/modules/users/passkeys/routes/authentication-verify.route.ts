import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_users } from "@/database/users";
import {
  holdSignInForAccountDeletion,
  zodAccountDeletionHold,
} from "@/lib/account-deletion/sign-in-hold";
import {
  EMAIL_NOT_VERIFIED,
  mustVerifyEmail,
} from "@/models/email-verification";
import { PasskeyError, PasskeyModel } from "@/models/passkey";
import { SessionModel } from "@/models/session";

import { passkeyFailure } from "../lib/failure";
import {
  PASSKEY_ERROR_RESPONSES,
  zodPasskeyAuthenticationResponseSchema,
  zodPasskeyErrorSchema,
} from "../passkeys.schema";

export const passkeyAuthenticationVerifyRoute = buildRoute({
  allowWhenOffline: true,
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
      403: {
        content: {
          "application/json": {
            schema: z.union([zodPasskeyErrorSchema, zodAccountDeletionHold]),
          },
        },
        description:
          "The passkey could not be verified or the email is not confirmed yet. For an account scheduled for deletion: `{ error: 'account_deletion_pending', scheduledAt, token }`, and no session starts until `POST /sign_in/cancel-deletion` confirms with that token",
      },
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

      const hold = await holdSignInForAccountDeletion(c, userId);
      if (hold) return c.json(hold, 403);

      await new SessionModel(c).createSessionByUserId(userId);

      return c.json({ id: userId }, 201);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
