import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { availableAiActions } from "@/api/lib/ai/available-actions";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const availableAiActionsAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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
