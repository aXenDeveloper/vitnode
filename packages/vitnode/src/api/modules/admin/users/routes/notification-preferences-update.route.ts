import { buildRoute } from "@/api/lib/route";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/api/models/notifications/preferences";
import {
  zodNotificationPreferences,
  zodUpdateNotificationPreferences,
} from "@/api/modules/notifications/routes/preferences.route";
import { CONFIG_PLUGIN } from "@/config";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";
import {
  findTargetUserId,
  userNotFoundResponse,
  zodTargetUserParams,
} from "../lib/target-user";

export const updateUserNotificationPreferencesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
  route: {
    method: "put",
    description:
      "Save a user's notification preferences. Staff may change types the installation locks for members, but never mandatory ones (Admin only)",
    path: "/{id}/notification-preferences",
    request: {
      params: zodTargetUserParams,
      body: {
        required: true,
        content: {
          "application/json": { schema: zodUpdateNotificationPreferences },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: zodNotificationPreferences },
        },
        description: "Saved, with the preferences as they are now",
      },
      400: {
        description:
          "An unknown or mandatory type, or a channel the type does not offer",
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

    await assertCanEditAdminTarget(c, userId);
    await updateNotificationPreferences(c, userId, c.req.valid("json"));

    return c.json(
      await getNotificationPreferences(c, {
        language: c.get("admin")?.user.language,
        userId,
      }),
      200,
    );
  },
});
