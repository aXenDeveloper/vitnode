import { z } from "zod";

import { buildRoute } from "@/builders";
import { describeError } from "@/lib/error-details";
import { assertPasswordSignInEnabled } from "@/lib/password-sign-in";
import { EmailVerificationModel } from "@/models/email-verification";
import { PasswordModel } from "@/models/password";
import { UserModel } from "@/models/user";

import { SessionModel } from "../../../models/session";
import {
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_PASSWORD_MAX_LENGTH,
} from "../lib/credential-limits";

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
  /**
   * The Terms of Service version shown on the form, accepted with an
   * explicit checkbox. Required while a Terms version is effective; it must
   * be that exact version, or the sign-up answers `409 TERMS_VERSION_CHANGED`.
   */
  terms: z
    .object({
      accepted: z.literal(true),
      locale: z.string().min(1).max(32),
      versionId: z.number().int().positive(),
    })
    .nullable()
    .optional(),
});

export const signUpRoute = buildRoute({
  termsAcceptance: "exempt",
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
        description:
          "Bad Request, or `TERMS_ACCEPTANCE_MISSING` when the effective Terms of Service were not accepted",
      },
      409: {
        description:
          "Email or name already exists, or `TERMS_VERSION_CHANGED` when the Terms shown are no longer the effective version",
      },
    },
  },
  handler: async c => {
    assertPasswordSignInEnabled(c);
    const hashedPassword = await new PasswordModel().encryptPassword(
      c.req.valid("json").password,
    );
    const data = await new UserModel().signUp(
      {
        ...c.req.valid("json"),
        hashedPassword,
        terms: c.req.valid("json").terms ?? null,
      },
      c,
    );

    if (data.emailVerified) {
      await new SessionModel(c).createSessionByUserId(data.id);
    } else {
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
