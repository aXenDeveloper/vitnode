import { buildRoute } from "@/api/builders";
import { markNotificationUnread } from "@/api/models/notifications/inbox";

import { requireNotificationUser } from "../lib/require-notification-user";
import {
  stateResponse,
  zodNotificationIdParams,
} from "../notifications.schema";

export const markNotificationUnreadRoute = buildRoute({
  route: {
    method: "post",
    description: "Mark one notification unread again.",
    path: "/{id}/unread",
    request: { params: zodNotificationIdParams },
    responses: stateResponse,
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const { id } = c.req.valid("param");

    return c.json(
      await markNotificationUnread(c, { notificationId: id, userId: user.id }),
    );
  },
});
