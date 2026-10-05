import { buildRoute } from "@/api/lib/route";
import { getNotificationPreferences } from "@/api/models/notifications/preferences";
import { zodNotificationPreferences } from "@/api/modules/notifications/routes/preferences.route";
import { CONFIG_PLUGIN } from "@/config";

import {
  findTargetUserId,
  userNotFoundResponse,
  zodTargetUserParams,
} from "../lib/target-user";

export const listUserNotificationPreferencesAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Every notification type the installation offers, with the channels it may use and what a user currently receives. Only mandatory types are locked for staff (Admin only)",
    path: "/{id}/notification-preferences",
    request: {
      params: zodTargetUserParams,
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: zodNotificationPreferences },
        },
        description: "Notification preferences",
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

    return c.json(
      await getNotificationPreferences(c, {
        language: c.get("admin")?.user.language,
        userId,
      }),
      200,
    );
  },
});
