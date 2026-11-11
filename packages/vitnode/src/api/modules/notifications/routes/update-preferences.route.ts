import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { updateNotificationPreferences } from "@/api/models/notifications/preferences";

import { requireNotificationUser } from "../lib/require-notification-user";
import {
  unauthorizedResponse,
  zodUpdateNotificationPreferences,
} from "../notifications.schema";

export const updateNotificationPreferencesRoute = buildRoute({
  route: {
    method: "put",
    description:
      "Save notification preferences, digest schedule and time zone.",
    path: "/preferences",
    request: {
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
          "application/json": { schema: z.object({ success: z.boolean() }) },
        },
        description: "Saved",
      },
      400: {
        description: "A type, mode or time zone this site does not offer",
      },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    await updateNotificationPreferences(c, user.id, c.req.valid("json"));

    return c.json({ success: true });
  },
});
