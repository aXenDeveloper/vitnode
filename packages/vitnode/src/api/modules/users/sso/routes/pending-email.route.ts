import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { SsoEmailCompletionModel } from "@/api/models/sso-email-completion";

import { USER_EMAIL_MAX_LENGTH } from "../../lib/credential-limits";
import { pendingFailure } from "../lib/pending-failure";
import { providerParams, zodPendingError } from "../pending.schema";

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
      "Email a confirmation link to the address the visitor wants to use, for the provider identity this browser is completing. The link only works in this browser. Answers the same whether or not the address has an account.",
    path: "/pending/{providerId}/email",
    request: {
      params: providerParams,
      body: {
        required: true,
        content: { "application/json": { schema: zodSsoPendingEmailSchema } },
      },
    },
    responses: {
      201: { description: "Link sent" },
      400: {
        content: { "application/json": { schema: zodPendingError } },
        description: "No live pending sign-in in this browser",
      },
      429: {
        content: { "application/json": { schema: zodPendingError } },
        description: "Too many emails, or the last one was sent moments ago",
      },
    },
  },
  handler: async c => {
    const { providerId } = c.req.valid("param");
    const { email } = c.req.valid("json");

    try {
      await new SsoEmailCompletionModel(c).sendLink({ email, providerId });
    } catch (error) {
      const { error: code, status } = pendingFailure(error);

      return status === 429
        ? c.json({ error: code }, 429)
        : c.json({ error: code }, 400);
    }

    return c.body(null, 201);
  },
});
