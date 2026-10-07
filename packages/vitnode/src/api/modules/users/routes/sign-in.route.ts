import { z } from "zod";

import { assertPasswordSignInEnabled } from "@/api/lib/password-sign-in";
import { buildRoute } from "@/api/lib/route";
import {
  EMAIL_NOT_VERIFIED,
  mustVerifyEmail,
} from "@/api/models/email-verification";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import { UserModel } from "@/api/models/user";
import { CONFIG_PLUGIN } from "@/config";

import {
  USER_EMAIL_MAX_LENGTH,
  USER_PASSWORD_MAX_LENGTH,
} from "../credential-limits";

export const zodSignInSchema = z.object({
  email: z.email().max(USER_EMAIL_MAX_LENGTH).toLowerCase().openapi({
    example: "test@test.com",
  }),
  password: z.string().max(USER_PASSWORD_MAX_LENGTH).openapi({
    example: "Test123!",
  }),
  isAdmin: z.boolean().optional().openapi({
    example: false,
  }),
});

export const signInRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Sign in with email and password",
    path: "/sign_in",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodSignInSchema,
          },
        },
      },
    },
    responses: {
      403: {
        content: {
          "application/json": {
            schema: z.object({ error: z.literal(EMAIL_NOT_VERIFIED) }),
          },
        },
        description:
          "Access Denied. Wrong credentials answer with no body; a correct password for an account whose email is not confirmed yet answers `{ error: 'email_not_verified' }`.",
      },
      201: {
        content: {
          "application/json": {
            // The session token travels in the HttpOnly cookie and nowhere
            // else. Echoing it here handed it to every script on the page,
            // which is the one thing HttpOnly exists to prevent.
            schema: z.object({
              id: z.number(),
            }),
          },
        },
        description: "User signed in",
      },
    },
  },
  handler: async c => {
    const { password, isAdmin, email } = c.req.valid("json");
    if (!isAdmin) assertPasswordSignInEnabled(c);
    const data = await new UserModel().signInWithPassword({
      password,
      email,
      c,
    });

    if (isAdmin) {
      // The AdminCP admits staff only, and staff are chosen by an
      // administrator - so it does not wait on the address being confirmed.
      // An install that just started sending confirmation emails would
      // otherwise lock every existing administrator out of the AdminCP.
      await new SessionAdminModel(c).createSessionByUserId(data.id);

      return c.json({ id: data.id }, 201);
    }

    if (mustVerifyEmail(c, data)) {
      return c.json({ error: EMAIL_NOT_VERIFIED } as const, 403);
    }

    await new SessionModel(c).createSessionByUserId(data.id);

    return c.json({ id: data.id }, 201);
  },
});
