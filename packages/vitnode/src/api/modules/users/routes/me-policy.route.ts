import { HTTPException } from "hono/http-exception";

import {
  resolvePersonalInfoPolicy,
  zodPersonalInfoPolicy,
} from "@/api/lib/personal-info-policy";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const mePolicyRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "What the signed-in user may change on their own account, from their roles.",
    path: "/me/policy",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodPersonalInfoPolicy,
          },
        },
        description: "Account allowances",
      },
      401: {
        description: "Not signed in",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    return c.json(await resolvePersonalInfoPolicy(c, user), 200);
  },
});
