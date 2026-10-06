import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { startCheckout } from "@/api/models/payments/checkout";
import { requirePaymentsUser } from "@/api/models/payments/shared";
import { CONFIG_PLUGIN } from "@/config";
import { BILLING_INTERVALS } from "@/payments/status";

import { privateResponse } from "../private-response";
import {
  paymentsErrorResponses,
  serializePurchase,
  zodPurchase,
} from "../schema";

export const checkoutRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Start or resume a hosted checkout for the signed-in user. The body names an offer, a currency and (for subscriptions) an interval; the price, buyer and return URLs are resolved on the server. Repeating a request with the same `idempotencyKey` returns the same purchase.",
    path: "/checkout",
    middleware: [privateResponse],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              currency: z.string().regex(/^[A-Z]{3}$/),
              idempotencyKey: z
                .string()
                .regex(/^[A-Za-z0-9_-]{8,100}$/)
                .optional(),
              interval: z.enum(BILLING_INTERVALS).nullable().default(null),
              offerId: z.string().min(1).max(64),
              pluginId: z.string().min(1).max(100),
              provider: z.string().max(32).optional(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              checkoutUrl: z.string().nullable(),
              purchase: zodPurchase,
            }),
          },
        },
        description:
          "The purchase, and the URL to send the buyer to - `null` when it is already paid, processing or over",
      },
      ...paymentsErrorResponses,
      502: { description: "The provider refused to create the checkout" },
    },
  },
  handler: async c => {
    const user = requirePaymentsUser(c);
    const body = c.req.valid("json");
    const result = await startCheckout(c, user, body);

    return c.json({
      checkoutUrl: result.checkoutUrl,
      purchase: serializePurchase(result.purchase),
    });
  },
});
