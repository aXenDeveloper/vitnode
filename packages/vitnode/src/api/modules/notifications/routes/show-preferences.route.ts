import { buildRoute } from "@/api/builders";
import { getNotificationPreferences } from "@/api/models/notifications/preferences";

import { requireNotificationUser } from "../lib/require-notification-user";
import {
  unauthorizedResponse,
  zodNotificationPreferences,
} from "../notifications.schema";

export const getNotificationPreferencesRoute = buildRoute({
  route: {
    method: "get",
    description:
      "Every notification type the installation offers, with the channels it may use and what the user currently receives.",
    path: "/preferences",
    responses: {
      200: {
        content: { "application/json": { schema: zodNotificationPreferences } },
        description: "Notification preferences",
      },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);

    return c.json(
      await getNotificationPreferences(c, {
        language: user.language,
        userId: user.id,
      }),
    );
  },
});
