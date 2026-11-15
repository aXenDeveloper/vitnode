import { z } from "zod";

import { buildRoute } from "@/builders";
import { pauseNotifications } from "@/models/notifications/danger";

import {
  auditDanger,
  canManageNotifications,
  dangerResponses,
} from "../lib/danger-zone";

export const pauseNotificationsRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Stop fanning out and sending notifications. New events are still stored and wait until notifications resume.",
    path: "/pause",
    responses: dangerResponses(z.object({ success: z.boolean() }), "Paused"),
  },
  handler: async c => {
    await pauseNotifications(c);
    await auditDanger(c, "paused");

    return c.json({ success: true });
  },
});
