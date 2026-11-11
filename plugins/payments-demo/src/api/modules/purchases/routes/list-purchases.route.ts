import { z } from "@hono/zod-openapi";
import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { payments_demo_purchases } from "@/database/purchases";

import { describePurchase } from "../lib/describe-purchase";
import { zodPurchase } from "../purchases.schema";

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
