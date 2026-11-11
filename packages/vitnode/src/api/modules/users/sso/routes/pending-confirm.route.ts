import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { SessionModel } from "@/api/models/session";
import { SsoEmailCompletionModel } from "@/api/models/sso-email-completion";

import { pendingFailure } from "../lib/pending-failure";
import { providerParams, zodPendingError } from "../pending.schema";

export const zodSsoPendingConfirmSchema = z.object({
  token: z
    .string()
    .regex(/^[\w-]{43,128}$/)
    .openapi({ example: "Zm9vYmFyYmF6cXV4cXV1eHF1dXhxdXV4cXV1eHF1dXg" }),
});

export const ssoPendingConfirmRoute = buildRoute({
  route: {
    method: "post",
    description:
      "Confirm the address with the token from the emailed link, in the browser that started the sign-in. Works once: signs up a new member with the confirmed address, or - when it belongs to an account - answers with the link offer that account's password unlocks.",
    path: "/pending/{providerId}/confirm",
    request: {
      params: providerParams,
      body: {
        required: true,
        content: {
          "application/json": { schema: zodSsoPendingConfirmSchema },
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
        description:
          "`invalid_pending`: no pending sign-in in this browser (another browser, or expired). `invalid_link`: the link expired, was replaced or was already used",
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
    const { token } = c.req.valid("json");

    let outcome: Awaited<ReturnType<SsoEmailCompletionModel["confirm"]>>;
    try {
      outcome = await new SsoEmailCompletionModel(c).confirm({
        providerId,
        token,
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
