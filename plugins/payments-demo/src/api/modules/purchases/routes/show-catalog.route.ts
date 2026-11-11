import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { DEMO_ITEM_IDS, DEMO_ITEMS } from "@/catalog";

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
