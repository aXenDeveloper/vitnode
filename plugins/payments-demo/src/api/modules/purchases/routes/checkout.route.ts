import { z } from "@hono/zod-openapi";
import { PAYMENT_ERROR_STATUS } from "@vitnode/core/api/lib/payments/errors";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { DEMO_ITEM_IDS } from "@/catalog";

import { createPurchasesService } from "../purchases.service";

const zodError = (description: string) => ({
  content: {
    "application/json": { schema: z.object({ error: z.string() }) },
  },
  description,
});

export const checkoutRoute = buildRoute({
  route: {
    method: "post",
    path: "/checkout",
    description:
      "Starts (or resumes) a hosted checkout for the demo item. The price comes from the server.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              itemId: z.enum(DEMO_ITEM_IDS),
              providerId: z.string().min(1).max(100),
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
              paymentId: z.string(),
              purchaseId: z.number(),
              redirectUrl: z.string(),
            }),
          },
        },
        description: "Send the browser to `redirectUrl`",
      },
      400: zodError("Unknown provider or invalid item"),
      401: { description: "Not signed in" },
      409: zodError(
        "Already owned, or a payment for this purchase is still in progress",
      ),
      502: zodError("The provider refused the checkout"),
      503: zodError("The provider is unavailable; try again"),
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401);
    const { itemId, providerId } = c.req.valid("json");

    const result = await createPurchasesService({
      db: c.get("db"),
      payments: c.get("payments"),
    }).checkout({ actor: { id: user.id }, itemId, providerId });

    if (result.ok) return c.json(result.checkout, 200);
    if (result.error === "already_owned") {
      return c.json({ error: result.error }, 409);
    }

    const status = PAYMENT_ERROR_STATUS[result.error];
    switch (status) {
      case 400:
      case 409:
      case 502:
      case 503:
        return c.json({ error: result.error }, status);
      default:
        throw new HTTPException(500);
    }
  },
});
