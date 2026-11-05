import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { deleteAuthCookie } from "@/api/lib/auth-cookie";
import { assertPasswordSignInEnabled } from "@/api/lib/password-sign-in";
import { hashSessionToken } from "@/api/lib/session-token";
import {
  EMAIL_NOT_VERIFIED,
  mustVerifyEmail,
} from "@/api/models/email-verification";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import { UserModel } from "@/api/models/user";
import { isPasswordStillCurrent } from "@/api/models/user/sign-in-with-passwords";
import { core_admin_sessions } from "@/database/admins";
import { core_sessions } from "@/database/sessions";

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

const revokeIfPasswordChanged = async (
  c: Context,
  data: { id: number; passwordHash: string },
  { admin, token }: { admin: boolean; token: string },
): Promise<void> => {
  if (await isPasswordStillCurrent(c, data)) return;

  const hashed = await hashSessionToken(token);
  const { authorization } = c.get("core");
  if (admin) {
    await c
      .get("db")
      .delete(core_admin_sessions)
      .where(eq(core_admin_sessions.token, hashed));
    deleteAuthCookie(c, authorization.adminCookieName);
  } else {
    await c
      .get("db")
      .delete(core_sessions)
      .where(eq(core_sessions.token, hashed));
    deleteAuthCookie(c, authorization.cookieName);
  }

  throw new HTTPException(403);
};

export const signInRoute = buildRoute({
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
      const { token } = await new SessionAdminModel(c).createSessionByUserId(
        data.id,
      );
      await revokeIfPasswordChanged(c, data, { admin: true, token });

      return c.json({ id: data.id }, 201);
    }

    if (mustVerifyEmail(c, data)) {
      return c.json({ error: EMAIL_NOT_VERIFIED } as const, 403);
    }

    const { token } = await new SessionModel(c).createSessionByUserId(data.id);
    await revokeIfPasswordChanged(c, data, { admin: false, token });

    return c.json({ id: data.id }, 201);
  },
});
