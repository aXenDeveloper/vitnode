import { z } from "@hono/zod-openapi";
import { PaymentError } from "@vitnode/core/api/lib/payments/errors";
import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { DEMO_ITEM_IDS, DEMO_ITEMS, purchaseReference } from "@/catalog";
import { payments_demo_purchases } from "@/database/purchases";

import { describePurchase, zodPurchase } from "./purchase-status";

const zodError = (description: string) => ({
  content: {
    "application/json": { schema: z.object({ error: z.string() }) },
  },
  description,
});

export const catalogRoute = buildRoute({
  route: {
    method: "get",
    path: "/catalog",
    description:
      "The demo item with its server-side price, and the payment providers a buyer may pick",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(
                z.object({
                  amount: z.number(),
                  currency: z.string(),
                  id: z.string(),
                  title: z.string(),
                }),
              ),
              providers: z.array(
                z.object({ id: z.string(), name: z.string() }),
              ),
            }),
          },
        },
        description: "Items and providers",
      },
    },
  },
  handler: c =>
    c.json(
      {
        items: DEMO_ITEM_IDS.map(id => ({ id, ...DEMO_ITEMS[id] })),
        providers: c
          .get("payments")
          .providers()
          .map(({ id, name }) => ({ id, name })),
      },
      200,
    ),
});

export const myPurchasesRoute = buildRoute({
  route: {
    method: "get",
    path: "/",
    description:
      "The signed-in member's purchases, each with its payment state",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ purchases: z.array(zodPurchase) }),
          },
        },
        description: "Purchases, oldest first",
      },
      401: { description: "Not signed in" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401);

    const rows = await c
      .get("db")
      .select()
      .from(payments_demo_purchases)
      .where(eq(payments_demo_purchases.userId, user.id))
      .orderBy(asc(payments_demo_purchases.id));

    const purchases = await Promise.all(
      rows.map(async row =>
        describePurchase(c, row, { refresh: false, userId: user.id }),
      ),
    );

    return c.json({ purchases }, 200);
  },
});

export const purchaseRoute = buildRoute({
  route: {
    method: "get",
    path: "/{purchaseId}",
    description:
      "One of the signed-in member's purchases. An open payment is re-checked with its provider at most every 15 seconds.",
    request: {
      params: z.object({ purchaseId: z.coerce.number().int().positive() }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodPurchase } },
        description: "The purchase",
      },
      401: { description: "Not signed in" },
      404: { description: "No such purchase, or it belongs to someone else" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401);
    const { purchaseId } = c.req.valid("param");

    const [purchase] = await c
      .get("db")
      .select()
      .from(payments_demo_purchases)
      .where(
        and(
          eq(payments_demo_purchases.id, purchaseId),
          eq(payments_demo_purchases.userId, user.id),
        ),
      )
      .limit(1);
    if (!purchase) throw new HTTPException(404);

    return c.json(
      await describePurchase(c, purchase, { refresh: true, userId: user.id }),
      200,
    );
  },
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
    const item = DEMO_ITEMS[itemId];
    const db = c.get("db");

    await db
      .insert(payments_demo_purchases)
      .values({ itemId, userId: user.id })
      .onConflictDoNothing();
    const [purchase] = await db
      .select()
      .from(payments_demo_purchases)
      .where(
        and(
          eq(payments_demo_purchases.userId, user.id),
          eq(payments_demo_purchases.itemId, itemId),
        ),
      )
      .limit(1);
    if (!purchase) throw new HTTPException(500);

    const payments = c.get("payments");
    const reference = purchaseReference(purchase.id);
    const attempts = await payments.listByReference(reference);
    if (attempts.some(attempt => attempt.status === "succeeded")) {
      return c.json({ error: "already_owned" }, 409);
    }

    try {
      const checkout = await payments.createCheckout({
        amount: item.amount,
        cancelPath: `/payments-demo/purchases/${purchase.id}`,
        currency: item.currency,
        description: "VitNode demo sticker pack",
        providerId,
        reference,
        successPath: `/payments-demo/purchases/${purchase.id}`,
        userId: user.id,
      });

      return c.json(
        {
          paymentId: checkout.paymentId,
          purchaseId: purchase.id,
          redirectUrl: checkout.redirectUrl,
        },
        200,
      );
    } catch (error) {
      if (!(error instanceof PaymentError)) throw error;

      switch (error.status) {
        case 400:
        case 409:
        case 502:
        case 503:
          return c.json({ error: error.code }, error.status);
        default:
          throw new HTTPException(500);
      }
    }
  },
});
