import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import {
  PaymentError,
  PaymentWebhookVerificationError,
} from "@/api/lib/payments/errors";

const outcomeSchema = z.object({
  outcome: z.enum([
    "duplicate",
    "ignored",
    "mismatch",
    "processed",
    "unmatched",
  ]),
});

export const paymentWebhookRoute = buildRoute({
  route: {
    method: "post",
    path: "/webhooks/{providerId}",
    description:
      "Receives a payment provider's webhook. The provider instance comes from the path; the body is verified with that instance's secret before anything changes.",
    request: {
      params: z.object({ providerId: z.string().min(1).max(100) }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: outcomeSchema } },
        description:
          "Verified and handled, or verified and not relevant. Redeliveries answer `duplicate`.",
      },
      400: { description: "The signature or payload did not verify." },
      404: { description: "No provider instance has this id." },
      500: {
        description:
          "Not recorded - the provider should redeliver the event later.",
      },
    },
  },
  handler: async c => {
    const { providerId } = c.req.valid("param");
    const rawBody = new Uint8Array(await c.req.arrayBuffer());

    try {
      const result = await c.get("payments").handleWebhook({
        body: rawBody,
        headers: c.req.raw.headers,
        providerId,
      });

      return c.json({ outcome: result.outcome }, 200);
    } catch (error) {
      if (
        error instanceof PaymentError &&
        error.code === "provider_not_found"
      ) {
        return c.json({ error: "provider_not_found" }, 404);
      }
      if (error instanceof PaymentWebhookVerificationError) {
        return c.json({ error: "invalid_signature" }, 400);
      }

      await c
        .get("log")
        .error(
          `[payments] Webhook for provider "${providerId}" failed and will be redelivered: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

      return c.json({ error: "processing_failed" }, 500);
    }
  },
});
