import { and, eq, gt } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { ForgotPasswordTokenModel, PasswordModel } from "@/api/models/password";
import { revokeAllSessionsForUser } from "@/api/models/session-revoke";
import { CONFIG_PLUGIN } from "@/config";
import { core_users, core_users_forgot_password } from "@/database/users";

export const zodChangePasswordSchema = z.object({
  password: z.string().min(8).openapi({
    example: "Test123!",
  }),
  userId: z.number().openapi({ example: 123456 }),
  token: z.string().openapi({ example: "abcdefg12345" }),
});

export const changePasswordRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Change user password",
    path: "/change-password",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodChangePasswordSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Password changed",
      },
      400: {
        // Thrown by the handler below when the `userId` + `token` +
        // unexpired-`expiresAt` lookup finds nothing - a wrong link, a spent one,
        // or one older than thirty minutes. Declared so the status is part of the
        // route's contract rather than an undocumented throw a client has to
        // discover: `fetcher()` types `res.status` from this list, so a caller
        // cannot branch on a status the route does not admit to.
        description: "Invalid or expired token",
      },
    },
  },
  handler: async c => {
    const { password, userId, token } = c.req.valid("json");

    // The column holds a digest, never the token itself - see the reset route.
    // Matching on the digest is what lets the stored value be useless to anyone
    // who reads the table.
    const hashedToken = new ForgotPasswordTokenModel().hashResetToken(token);

    const [user] = await c
      .get("db")
      .select()
      .from(core_users_forgot_password)
      .where(
        and(
          eq(core_users_forgot_password.userId, userId),
          eq(core_users_forgot_password.token, hashedToken),
          gt(core_users_forgot_password.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!user) {
      throw new HTTPException(400, { message: "Invalid token" });
    }

    const hashPassword = await new PasswordModel().encryptPassword(password);
    await Promise.all([
      c
        .get("db")
        .update(core_users)
        .set({ password: hashPassword })
        .where(eq(core_users.id, userId)),
      c
        .get("db")
        .delete(core_users_forgot_password)
        .where(eq(core_users_forgot_password.id, user.id)),
    ]);

    // After the new password is in place, so a failure above cannot sign
    // somebody out without having changed anything. Whoever reset this password
    // is doing it because the old credential is not trusted any more, and every
    // session opened with it is exactly as untrusted - including the attacker's,
    // which would otherwise outlive the reset by up to ninety days.
    await revokeAllSessionsForUser(c, userId);

    return c.text("Password changed", 201);
  },
});
