import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { CONFIG_PLUGIN } from "@/config";

import { requireSignedInUser } from "../../../passkeys/failure";
import { ssoConnectionFailure } from "../failure";
import {
  SSO_CONNECTION_ERROR_RESPONSES,
  zodSsoProviderIdParam,
} from "../schema";

export const disconnectSsoConnectionRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "delete",
    description:
      "Remove the signed-in user's connection to a provider and its profile sync settings. Refused when it is the account's last way to sign in. Does not revoke anything at the provider.",
    path: "/{providerId}",
    request: {
      params: z.object({ providerId: zodSsoProviderIdParam }),
    },
    responses: {
      200: { description: "Connection removed" },
      ...SSO_CONNECTION_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));
    const { providerId } = c.req.valid("param");

    try {
      await new SsoConnectionModel(c).disconnect({
        providerId,
        userId: user.id,
      });

      return c.body(null, 200);
    } catch (error) {
      return ssoConnectionFailure(c, error);
    }
  },
});
