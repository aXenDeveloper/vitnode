import { buildRoute } from "@/api/lib/route";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { zodSsoConnectionsOverview } from "@/api/modules/users/sso/connections/schema";
import { CONFIG_PLUGIN } from "@/config";

import {
  findTargetUserId,
  userNotFoundResponse,
  zodTargetUserParams,
} from "../lib/target-user";

export const listUserSsoAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_view" },
  route: {
    method: "get",
    description:
      "List the configured SSO providers with a user's connection to each, their sign-in methods and where their profile fields come from (Admin only)",
    path: "/{id}/sso",
    request: {
      params: zodTargetUserParams,
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: zodSsoConnectionsOverview },
        },
        description: "Providers, connections and profile sources",
      },
      403: {
        description: "Access Denied",
      },
      404: userNotFoundResponse,
    },
  },
  handler: async c => {
    const userId = await findTargetUserId(c, c.req.valid("param").id);
    if (userId === null) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(await new SsoConnectionModel(c).overview(userId), 200);
  },
});
