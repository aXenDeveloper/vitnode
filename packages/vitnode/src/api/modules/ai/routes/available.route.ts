import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { availableAiActions } from "@/api/lib/ai/available-actions";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

/** Which AI actions the signed-in user may start - for showing AI buttons. */
export const availableAiActionsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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
    if (!user.id) throw new HTTPException(401);

    return c.json({ actions: await availableAiActions(c, user.id) }, 200);
  },
});
