import { bodyLimit } from "hono/body-limit";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { describePaymentsError } from "@/api/models/payments/shared";
import { acceptWebhookEvent } from "@/api/models/payments/webhooks";
import { processQueueTasksByIds } from "@/api/modules/queue/helpers/process-queue-tasks";
import { CONFIG_PLUGIN } from "@/config";
import {
  isPaymentWebhookSignatureError,
  type ProviderWebhookEvent,
} from "@/payments/provider";

/**
 * Provider events are small. The cap is far below the API's general body limit,
 * so an unauthenticated caller cannot make this route buffer much before the
 * signature has been checked.
 */
export const WEBHOOK_MAX_BODY_BYTES = 512 * 1024;

export const webhookRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Receives payment provider webhooks. No session: every request is authenticated by the provider's signature over the exact bytes received. Answers 2xx only after the event is stored and queued.",
    path: "/webhooks/{providerId}",
    middleware: [
      bodyLimit({
        maxSize: WEBHOOK_MAX_BODY_BYTES,
        onError: c => c.json({ error: "Payload Too Large" }, 413),
      }),
    ],
    request: {
      params: z.object({ providerId: z.string().regex(/^[a-z0-9-]{1,32}$/) }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              duplicate: z.boolean().optional(),
              ignored: z.boolean().optional(),
              received: z.boolean(),
            }),
          },
        },
        description:
          "Stored and queued, a duplicate, or an event type VitNode does not use",
      },
      400: { description: "The signature did not verify" },
      404: { description: "Payments is off or the provider is not configured" },
      413: { description: "Larger than any provider event" },
    },
  },
  handler: async c => {
    const provider = c
      .get("core")
      .payments.config?.providers.find(
        item => item.id === c.req.valid("param").providerId,
      );

    if (!provider) return c.json({ received: false }, 404);

    // The bytes exactly as they arrived. Parsing and re-serialising would
    // change them, and the signature is over these bytes, not the JSON.
    const body = new Uint8Array(await c.req.arrayBuffer());

    let event: ProviderWebhookEvent;
    try {
      event = await provider.webhooks.verify({
        body,
        headers: c.req.raw.headers,
      });
    } catch (error) {
      if (isPaymentWebhookSignatureError(error)) {
        await c
          .get("log")
          .warn(
            `[Payments] Rejected a ${provider.id} webhook: ${error.message}`,
          );

        return c.json({ received: false }, 400);
      }

      throw error;
    }

    const { target } = event;

    if (!target) return c.json({ ignored: true, received: true });

    if (event.scope !== provider.scope) {
      await c
        .get("log")
        .warn(
          `[Payments] Ignored ${provider.id} event ${event.id}: it is from "${event.scope}" but this install uses "${provider.scope}" keys.`,
        );

      return c.json({ ignored: true, received: true });
    }

    // Throws if the event cannot be stored and queued - the provider then sees
    // a 5xx and redelivers, which is exactly what should happen.
    const accepted = await acceptWebhookEvent(c, provider, {
      ...event,
      target,
    });

    if (accepted.status === "duplicate") {
      return c.json({ duplicate: true, received: true });
    }

    // Best effort, after acceptance: the queue worker is what guarantees it.
    void processQueueTasksByIds(c, [accepted.queueId]).catch(
      async (error: unknown) => {
        await c
          .get("log")
          .warn(
            `[Payments] Immediate processing deferred to the queue: ${describePaymentsError(error)}`,
          );
      },
    );

    return c.json({ received: true });
  },
});
