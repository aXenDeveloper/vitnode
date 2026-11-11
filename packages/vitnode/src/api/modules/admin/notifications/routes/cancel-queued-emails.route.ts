import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { cancelQueuedNotificationEmails } from "@/api/models/notifications/danger";

import {
  auditDanger,
  canManageNotifications,
  dangerResponses,
} from "../lib/danger-zone";

export const cancelQueuedNotificationEmailsRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Skip every email that has not gone out yet, including the next digests. In-app notifications stay.",
    path: "/emails/cancel",
    responses: dangerResponses(
      z.object({ cancelled: z.number() }),
      "Cancelled",
    ),
  },
  handler: async c => {
    const result = await cancelQueuedNotificationEmails(c);
    await auditDanger(c, "emails_cancelled");

    return c.json(result);
  },
});
