import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { markEverythingRead } from "@/api/models/notifications/danger";

import {
  auditDanger,
  canManageNotifications,
  dangerResponses,
} from "../lib/danger-zone";

export const markEverythingReadRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Mark every unread notification as read for every member and zero their badges.",
    path: "/read-all",
    responses: dangerResponses(
      z.object({ items: z.number(), members: z.number() }),
      "Marked as read",
    ),
  },
  handler: async c => {
    const result = await markEverythingRead(c);
    await auditDanger(c, "all_marked_read");

    return c.json(result);
  },
});
