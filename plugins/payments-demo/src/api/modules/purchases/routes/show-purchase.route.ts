import { z } from "@hono/zod-openapi";
import { respondJson } from "@vitnode/core/api/lib/respond-json";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { payments_demo_purchases } from "@/database/purchases";

import { describePurchase } from "../lib/describe-purchase";
import { zodPurchase } from "../purchases.schema";

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

    return respondJson(
      c,
      200,
      zodPurchase,
      await describePurchase(c, purchase, { refresh: true, userId: user.id }),
    );
  },
});
