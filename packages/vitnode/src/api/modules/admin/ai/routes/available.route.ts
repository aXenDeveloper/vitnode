import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { availableAiActions } from "@/api/lib/ai/available-actions";

export const availableAiActionsAdminRoute = buildRoute({
  route: {
    method: "get",
    description: "The AI actions you may start in the AdminCP.",
    path: "/assist/available",
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
    const userId = c.get("admin")?.user.id;
    if (!userId) throw new HTTPException(403);

    return c.json({ actions: await availableAiActions(c, userId) }, 200);
  },
});
