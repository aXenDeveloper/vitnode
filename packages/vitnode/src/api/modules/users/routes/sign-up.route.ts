import { z } from "zod";

import { describeError } from "@/api/lib/error-details";
import { assertPasswordSignInEnabled } from "@/api/lib/password-sign-in";
import { buildRoute } from "@/api/lib/route";
import { EmailVerificationModel } from "@/api/models/email-verification";
import { PasswordModel } from "@/api/models/password";
import { UserModel } from "@/api/models/user";
import { CONFIG_PLUGIN } from "@/config";

import { SessionModel } from "../../../models/session";
import {
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_PASSWORD_MAX_LENGTH,
} from "../credential-limits";

const nameRegex = /^(?!.* {2})[\p{L}\p{N}._@ -]*$/u;

export const zodSignUpSchema = z.object({
  email: z.email().max(USER_EMAIL_MAX_LENGTH).toLowerCase().openapi({
    example: "test@test.com",
  }),
  name: z
    .string()
    .openapi({ example: "test" })
    .min(3)
    .max(USER_NAME_MAX_LENGTH)
    .refine(val => nameRegex.test(val), {
      message: "Invalid name",
    }),
  password: z.string().min(8).max(USER_PASSWORD_MAX_LENGTH).openapi({
    example: "Test123!",
  }),
  newsletter: z.boolean().default(false).optional(),
});

export const signUpRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Create a new user",
    path: "/sign_up",
    withCaptcha: true,
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodSignUpSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
              emailVerified: z.boolean(),
              email: z.email(),
            }),
          },
        },
        description:
          "User created. With `emailVerified: false` no session was started and a confirmation link was emailed instead.",
      },
      400: {
        description: "Bad Request",
      },
      409: {
        description: "Email or name already exists",
      },
    },
  },
  handler: async c => {
    assertPasswordSignInEnabled(c);
    const hashedPassword = await new PasswordModel().encryptPassword(
      c.req.valid("json").password,
    );
    const data = await new UserModel().signUp(
      { ...c.req.valid("json"), hashedPassword },
      c,
    );

    if (data.emailVerified) {
      await new SessionModel(c).createSessionByUserId(data.id);
    } else {
      // The account exists either way. A link that failed to go out is not a
      // reason to answer this sign-up with an error - the member would retry,
      // hit "email already exists", and be stuck - so it is logged and the
      // member can ask for another one from the sign-in page.
      try {
        await new EmailVerificationModel(c).send(data);
      } catch (error) {
        await c
          .get("log")
          .error(
            `Could not send the email confirmation link to user ${data.id}: ${describeError(error)}`,
          );
      }
    }

    return c.json(
      {
        id: data.id,
        emailVerified: data.emailVerified,
        email: data.email,
      },
      201,
    );
  },
});
