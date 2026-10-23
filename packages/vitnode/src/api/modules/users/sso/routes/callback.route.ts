import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { SessionModel } from "@/api/models/session";
import { SSOModel } from "@/api/models/sso";

export const callbackRoute = buildRoute({
  route: {
    method: "get",
    description: "SSO Callback",
    path: "/{providerId}/callback",
    request: {
      params: z.object({
        providerId: z.string(),
      }),
      query: z.object({
        code: z.string().min(1).max(4096),
        state: z.string().min(1).max(256),
        user: z.string().max(2048).optional().openapi({
          description:
            "Extra profile data some providers post back on a first authorization (Apple's `user`). Untrusted.",
        }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
            }),
          },
        },
        description: "URL",
      },
      202: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.string().nullable(),
              emailRequired: z.literal(true),
            }),
          },
        },
        description:
          "The provider shared no verified email. The visitor confirms one with a code (`/pending/{providerId}/email`); `email` is the provider's unverified suggestion, if any",
      },
      400: {
        description:
          "The state is unknown, expired, already used, from another browser or for another provider",
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
          "An account with this email already exists; the body carries what the link step needs",
      },
      422: {
        content: {
          "application/json": {
            schema: z.object({ error: z.literal("email_unavailable") }),
          },
        },
        description:
          "The provider shared no verified email and this install cannot send one to confirm",
      },
    },
  },
  handler: async c => {
    const { providerId } = c.req.valid("param");
    const { code, state, user } = c.req.valid("query");
    const outcome = await new SSOModel(c).callback({
      code,
      params: user === undefined ? {} : { user },
      providerId,
      state,
    });

    if (outcome.kind === "email_required") {
      return c.json(
        { email: outcome.email, emailRequired: true as const },
        202,
      );
    }

    if (outcome.kind === "email_unavailable") {
      return c.json({ error: "email_unavailable" as const }, 422);
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
