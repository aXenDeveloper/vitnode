import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { markAllNotificationsRead } from "@/api/models/notifications/inbox";

import { requireNotificationUser } from "../lib/require-notification-user";
import {
  unauthorizedResponse,
  zodNotificationState,
} from "../notifications.schema";

export const markAllNotificationsReadRoute = buildRoute({
  route: {
    method: "post",
    description:
      "Mark every notification read that exists when the request takes the user's lock. Anything delivered after stays unread.",
    path: "/read-all",
    request: {
      body: {
        required: false,
        content: {
          "application/json": {
            schema: z.object({ category: z.string().max(50).optional() }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodNotificationState.extend({ marked: z.number() }),
          },
        },
        description: "The unread state after the change",
      },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const body = c.req.header("content-type")?.includes("application/json")
      ? c.req.valid("json")
      : {};

    return c.json(
      await markAllNotificationsRead(c, {
        category: body.category,
        userId: user.id,
      }),
    );
  },
});
