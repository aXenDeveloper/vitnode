import { buildRoute } from "@/api/builders";
import { archiveNotification } from "@/api/models/notifications/inbox";

import { requireNotificationUser } from "../lib/require-notification-user";
import {
  stateResponse,
  zodNotificationIdParams,
} from "../notifications.schema";

export const archiveNotificationRoute = buildRoute({
  route: {
    method: "post",
    description:
      "Archive one notification. It leaves the inbox and the unread count; new activity brings it back.",
    path: "/{id}/archive",
    request: { params: zodNotificationIdParams },
    responses: stateResponse,
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const { id } = c.req.valid("param");

    return c.json(
      await archiveNotification(c, { notificationId: id, userId: user.id }),
    );
  },
});
