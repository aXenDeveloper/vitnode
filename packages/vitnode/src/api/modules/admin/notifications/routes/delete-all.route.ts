import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { deleteAllNotifications } from "@/api/models/notifications/danger";

import {
  auditDanger,
  canManageNotifications,
  dangerResponses,
} from "../lib/danger-zone";

export const deleteAllNotificationsRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Delete every member's notifications. Types, preferences, settings and email history are kept.",
    path: "/delete-all",
    responses: dangerResponses(
      z.object({ events: z.number(), items: z.number() }),
      "Deleted",
    ),
  },
  handler: async c => {
    const result = await deleteAllNotifications(c);
    await auditDanger(c, "all_deleted");

    return c.json(result);
  },
});
