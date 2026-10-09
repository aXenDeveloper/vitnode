import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { EmailVerificationModel } from "@/api/models/email-verification";
import { CONFIG_PLUGIN } from "@/config";

export const zodVerifyEmailSchema = z.object({
  token: z
    .string()
    .min(16)
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/)
    .openapi({ example: "abcdefg12345abcdefg12345" }),
});

export const verifyEmailRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Confirm an email address with the link sent at sign-up",
    path: "/verify-email",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodVerifyEmailSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ email: z.string() }),
          },
        },
        description: "Email confirmed - the member can sign in now",
      },
      400: {
        description: "The link is wrong, already used or expired",
      },
    },
  },
  handler: async c => {
    const { token } = c.req.valid("json");

    const user = await new EmailVerificationModel(c).verify(token);

    if (!user) {
      return c.text("Invalid or expired token", 400);
    }

    return c.json({ email: user.email }, 200);
  },
});
