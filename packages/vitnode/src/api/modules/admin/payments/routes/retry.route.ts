import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { retryFulfillment } from "@/api/models/payments/fulfillment";
import { retryWebhookEvent } from "@/api/models/payments/webhooks";
import { CONFIG_PLUGIN } from "@/config";

const RETRY_PERMISSION = {
  module: "payments",
  permission: "can_retry",
} as const;

const retryResponses = {
  200: {
    content: {
      "application/json": { schema: z.object({ queued: z.literal(true) }) },
    },
    description: "Queued again",
  },
  409: {
    description: "Nothing to retry - it already completed or is not failed",
  },
} as const;

export const retryFulfillmentAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: RETRY_PERMISSION,
  route: {
    method: "post",
    description:
      "Queue a fulfillment again through the normal queue. Idempotent: a fulfillment that already completed is never run again, so nothing can be granted twice.",
    path: "/fulfillments/{id}/retry",
    request: { params: z.object({ id: z.coerce.number().int().positive() }) },
    responses: retryResponses,
  },
  handler: async c => {
    if (!(await retryFulfillment(c, c.req.valid("param").id))) {
      throw new HTTPException(409, {
        message: "This fulfillment has nothing left to retry.",
      });
    }

    return c.json({ queued: true as const });
  },
});

export const retryWebhookEventAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: RETRY_PERMISSION,
  route: {
    method: "post",
    description:
      "Queue a failed webhook event for processing again. Processing re-reads the provider, so repeating it is safe.",
    path: "/events/{id}/retry",
    request: { params: z.object({ id: z.coerce.number().int().positive() }) },
    responses: retryResponses,
  },
  handler: async c => {
    if (!(await retryWebhookEvent(c, c.req.valid("param").id))) {
      throw new HTTPException(409, {
        message: "Only a failed event can be retried.",
      });
    }

    return c.json({ queued: true as const });
  },
});
