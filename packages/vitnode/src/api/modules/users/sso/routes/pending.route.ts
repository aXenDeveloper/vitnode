import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { SessionModel } from "@/api/models/session";
import { SsoEmailCompletionModel } from "@/api/models/sso-email-completion";

import { USER_EMAIL_MAX_LENGTH } from "../../credential-limits";

const zodPendingError = z.object({
  error: z.enum([
    "code_expired",
    "invalid_code",
    "invalid_pending",
    "too_many_codes",
  ]),
});

const pendingFailure = (error: unknown) => {
  if (
    error instanceof HTTPException &&
    (error.status === 400 || error.status === 429)
  ) {
    const parsed = zodPendingError.shape.error.safeParse(error.message);
    if (parsed.success) return { error: parsed.data, status: error.status };
  }

  throw error;
};

const providerParams = z.object({
  providerId: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[\w-]+$/),
});

export const zodSsoPendingEmailSchema = z.object({
  email: z
    .email()
    .max(USER_EMAIL_MAX_LENGTH)
    .toLowerCase()
    .openapi({ example: "test@test.com" }),
});

export const ssoPendingEmailRoute = buildRoute({
  route: {
    method: "post",
    description:
      "Email a six-digit code to the address the visitor wants to use, for the provider identity this browser is completing. Answers the same whether or not the address has an account.",
    path: "/pending/{providerId}/email",
    request: {
      params: providerParams,
      body: {
        required: true,
        content: { "application/json": { schema: zodSsoPendingEmailSchema } },
      },
    },
    responses: {
      201: { description: "Code sent" },
      400: {
        content: { "application/json": { schema: zodPendingError } },
        description: "No live pending sign-in in this browser",
      },
      429: {
        content: { "application/json": { schema: zodPendingError } },
        description: "Too many codes, or the last one was sent moments ago",
      },
    },
  },
  handler: async c => {
    const { providerId } = c.req.valid("param");
    const { email } = c.req.valid("json");

    try {
      await new SsoEmailCompletionModel(c).sendCode({ email, providerId });
    } catch (error) {
      const { error: code, status } = pendingFailure(error);

      return status === 429
        ? c.json({ error: code }, 429)
        : c.json({ error: code }, 400);
    }

    return c.body(null, 201);
  },
});

export const zodSsoPendingVerifySchema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/)
    .openapi({ example: "123456" }),
});

export const ssoPendingVerifyRoute = buildRoute({
  route: {
    method: "post",
    description:
      "Confirm the emailed code. Works once: signs up a new member with the confirmed address, or - when it belongs to an account - answers with the link offer that account's password unlocks.",
    path: "/pending/{providerId}/verify",
    request: {
      params: providerParams,
      body: {
        required: true,
        content: {
          "application/json": { schema: zodSsoPendingVerifySchema },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ id: z.number() }) },
        },
        description: "Signed in",
      },
      400: {
        content: { "application/json": { schema: zodPendingError } },
        description: "Wrong, expired or spent code, or no pending sign-in",
      },
      409: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.string(),
              hasPassword: z.boolean(),
              linkToken: z.string(),
            }),
          },
        },
        description:
          "The confirmed address belongs to an account; the body carries what the link step needs",
      },
    },
  },
  handler: async c => {
    const { providerId } = c.req.valid("param");
    const { code } = c.req.valid("json");

    let outcome: Awaited<ReturnType<SsoEmailCompletionModel["verifyCode"]>>;
    try {
      outcome = await new SsoEmailCompletionModel(c).verifyCode({
        code,
        providerId,
      });
    } catch (error) {
      return c.json({ error: pendingFailure(error).error }, 400);
    }

    if (outcome.kind === "link_required") {
      return c.json(
        {
          email: outcome.email,
          hasPassword: outcome.hasPassword,
          linkToken: outcome.linkToken,
        },
        409,
      );
    }

    await new SessionModel(c).createSessionByUserId(outcome.userId);

    return c.json({ id: outcome.userId }, 200);
  },
});
