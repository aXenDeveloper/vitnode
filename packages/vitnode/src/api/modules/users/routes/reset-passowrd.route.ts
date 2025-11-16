import { eq } from "drizzle-orm";
import { createTranslator } from "use-intl";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { ForgotPasswordTokenModel } from "@/api/models/password";
import { core_users, core_users_forgot_password } from "@/database/users";
import ResetPasswordEmailTemplate from "@/emails/reset-password";
import { CONFIG } from "@/lib/config";

export const resetPasswordRoute = buildRoute({
  route: {
    method: "post",
    description: "Request a password reset",
    path: "/reset-password",
    withCaptcha: true,
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              email: z.email().toLowerCase().openapi({
                example: "test@test.com",
              }),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Email sent",
      },
    },
  },
  handler: async c => {
    const RESPONSE_TEXT = c.text("Email sent", 201);
    const { email } = c.req.valid("json");
    const [findUser] = await c
      .get("db")
      .select({
        email: core_users.email,
        id: core_users.id,
        language: core_users.language,
      })
      .from(core_users)
      .where(eq(core_users.email, email))
      .limit(1);

    if (!findUser) {
      return RESPONSE_TEXT;
    }

    const hashToken = new ForgotPasswordTokenModel().generateResetToken();

    const [findLastRecord] = await c
      .get("db")
      .select()
      .from(core_users_forgot_password)
      .where(eq(core_users_forgot_password.userId, findUser.id))
      .limit(1);

    // If a record will be found with createdAt in the last 5 minutes, skip
    if (findLastRecord?.createdAt > new Date(Date.now() - 1000 * 60 * 5)) {
      return RESPONSE_TEXT;
    }

    const EXPIRES_AT = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    if (findLastRecord) {
      await c
        .get("db")
        .update(core_users_forgot_password)
        .set({
          createdAt: new Date(),
          expiresAt: EXPIRES_AT,
          token: hashToken,
          ipAddress: c.get("ipAddress"),
        })
        .where(eq(core_users_forgot_password.id, findLastRecord.id));
    } else {
      await c
        .get("db")
        .insert(core_users_forgot_password)
        .values({
          token: hashToken,
          ipAddress: c.get("ipAddress"),
          userId: findUser.id,
          expiresAt: EXPIRES_AT,
        });
    }

    // Send email
    const resetUrlNative = new URL(
      `login/reset-password?token=${hashToken}&userId=${findUser.id}`,
      CONFIG.web.href,
    );

    await c.get("email").send({
      user: {
        id: findUser.id,
        email: findUser.email,
        language: findUser.language,
      },
      content: props =>
        ResetPasswordEmailTemplate({
          ...props,
          resetUrl: resetUrlNative.href,
          expiryDate: EXPIRES_AT,
          userIpAddress: c.get("ipAddress"),
        }),
      subject: ({ i18n }) => {
        const t = createTranslator(i18n);

        return t("core.auth.reset_password.email.subject");
      },
    });

    return RESPONSE_TEXT;
  },
});
