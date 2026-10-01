import { buildRoute } from "@/api/lib/route";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { CONFIG_PLUGIN } from "@/config";

import { requireSignedInUser } from "../../../passkeys/failure";
import { ssoConnectionFailure } from "../failure";
import {
  SSO_CONNECTION_ERROR_RESPONSES,
  zodSsoConnectionsOverview,
} from "../schema";

export const listSsoConnectionsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "List the configured SSO providers with the signed-in user's connection to each, and where their profile fields come from.",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": { schema: zodSsoConnectionsOverview },
        },
        description: "Providers, connections and profile sources",
      },
      ...SSO_CONNECTION_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));

    try {
      return c.json(await new SsoConnectionModel(c).overview(user.id), 200);
    } catch (error) {
      return ssoConnectionFailure(c, error);
    }
  },
});
