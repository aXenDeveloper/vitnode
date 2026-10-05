import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { ssoConnectionFailure } from "@/api/modules/users/sso/connections/failure";
import {
  zodSsoConnectionErrorSchema,
  zodSsoProviderIdParam,
} from "@/api/modules/users/sso/connections/schema";
import { CONFIG_PLUGIN } from "@/config";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";
import {
  findTargetUserId,
  userNotFoundResponse,
  zodTargetUserParams,
} from "../lib/target-user";

export const disconnectUserSsoAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
  route: {
    method: "delete",
    description:
      "Remove a user's connection to a provider and its profile sync settings. Refused when it is the account's last way to sign in. Does not revoke anything at the provider (Admin only)",
    path: "/{id}/sso/{providerId}",
    request: {
      params: zodTargetUserParams.extend({
        providerId: zodSsoProviderIdParam,
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Connection removed",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        ...userNotFoundResponse,
        description: "User not found, or not connected to the provider",
      },
      409: {
        content: {
          "application/json": { schema: zodSsoConnectionErrorSchema },
        },
        description: "The connection is the account's last way to sign in",
      },
    },
  },
  handler: async c => {
    const { id, providerId } = c.req.valid("param");
    const userId = await findTargetUserId(c, id);
    if (userId === null) {
      return c.json({ error: "User not found" }, 404);
    }

    await assertCanEditAdminTarget(c, userId);

    try {
      await new SsoConnectionModel(c).disconnect({ providerId, userId });

      return c.json({ ok: true as const }, 200);
    } catch (error) {
      return ssoConnectionFailure(c, error);
    }
  },
});
