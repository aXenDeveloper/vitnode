import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { availableAiActions } from "@/api/lib/ai/available-actions";

export const availableAiActionsRoute = buildRoute({
  route: {
    method: "get",
    description: "The AI actions you may start.",
    path: "/available",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ actions: z.array(z.string()) }),
          },
        },
        description: "Available action keys",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) return c.json({ actions: [] }, 200);

    return c.json({ actions: await availableAiActions(c, user.id) }, 200);
  },
});
