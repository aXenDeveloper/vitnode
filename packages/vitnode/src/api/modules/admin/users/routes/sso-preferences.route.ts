import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { ssoConnectionFailure } from "@/api/modules/users/sso/connections/failure";
import { zodSsoPreferencesSchema } from "@/api/modules/users/sso/connections/routes/preferences.route";
import { zodSsoConnectionErrorSchema } from "@/api/modules/users/sso/connections/schema";
import { CONFIG_PLUGIN } from "@/config";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";
import {
  findTargetUserId,
  userNotFoundResponse,
  zodTargetUserParams,
} from "../lib/target-user";

const ssoErrorResponse = (description: string) => ({
  content: {
    "application/json": { schema: zodSsoConnectionErrorSchema },
  },
  description,
});

export const updateUserSsoPreferencesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
  route: {
    method: "put",
    description:
      "Choose which of a user's connected providers each profile field comes from (null keeps it managed manually), and whether signing in through a provider updates those fields (Admin only)",
    path: "/{id}/sso/preferences",
    request: {
      params: zodTargetUserParams,
      body: {
        required: true,
        content: { "application/json": { schema: zodSsoPreferencesSchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Preferences saved",
      },
      400: ssoErrorResponse(
        "A source or sync provider the user is not connected to",
      ),
      403: {
        description: "Access Denied",
      },
      404: userNotFoundResponse,
      409: ssoErrorResponse("A connection was removed while saving"),
    },
  },
  handler: async c => {
    const userId = await findTargetUserId(c, c.req.valid("param").id);
    if (userId === null) {
      return c.json({ error: "User not found" }, 404);
    }

    await assertCanEditAdminTarget(c, userId);

    const { sources, sync } = c.req.valid("json");

    try {
      await new SsoConnectionModel(c).savePreferences({
        sources,
        sync,
        userId,
      });

      return c.json({ ok: true as const }, 200);
    } catch (error) {
      return ssoConnectionFailure(c, error);
    }
  },
});
