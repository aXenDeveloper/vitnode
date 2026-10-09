import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { matchesEmail, pickAccountForEmail } from "@/api/lib/user-email-lookup";
import {
  EmailVerificationModel,
  isEmailVerificationRequired,
} from "@/api/models/email-verification";
import { CONFIG_PLUGIN } from "@/config";
import { core_users } from "@/database/users";

import { USER_EMAIL_MAX_LENGTH } from "../credential-limits";

export const resendVerificationRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Email a fresh confirmation link. Answers the same for every address, registered or not.",
    path: "/verify-email/resend",
    withCaptcha: true,
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              email: z
                .email()
                .max(USER_EMAIL_MAX_LENGTH)
                .toLowerCase()
                .openapi({
                  example: "test@test.com",
                }),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Email sent, if there was anything to send",
      },
      404: {
        description:
          "This install cannot send email, so there is nothing to confirm",
      },
    },
  },
  handler: async c => {
    if (!isEmailVerificationRequired(c)) {
      throw new HTTPException(404, {
        message: "Email verification is not available",
      });
    }

    const RESPONSE_TEXT = c.text("Email sent", 201);
    const { email } = c.req.valid("json");
    const candidates = await c
      .get("db")
      .select({
        email: core_users.email,
        emailVerified: core_users.emailVerified,
        id: core_users.id,
        language: core_users.language,
        name: core_users.name,
      })
      .from(core_users)
      .where(matchesEmail(email))
      .limit(2);
    const user = pickAccountForEmail(candidates, email);

    if (!user || user.emailVerified) {
      return RESPONSE_TEXT;
    }

    await new EmailVerificationModel(c).send(user, { respectCooldown: true });

    return RESPONSE_TEXT;
  },
});
