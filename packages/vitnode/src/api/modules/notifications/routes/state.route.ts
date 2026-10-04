import { buildRoute } from "@/api/lib/route";
import { getNotificationState } from "@/api/models/notifications/inbox";
import { CONFIG_PLUGIN } from "@/config";

import {
  requireNotificationUser,
  unauthorizedResponse,
  zodNotificationState,
} from "../schema";

export const notificationStateRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "The signed-in user's unread count and its revision - one primary-key read, never a COUNT(*).",
    path: "/state",
    responses: {
      200: {
        content: { "application/json": { schema: zodNotificationState } },
        description: "Unread state",
      },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);

    return c.json(await getNotificationState(c.get("db"), user.id));
  },
});
