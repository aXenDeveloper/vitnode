import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { resumeNotifications } from "@/api/models/notifications/danger";

import {
  auditDanger,
  canManageNotifications,
  dangerResponses,
} from "../lib/danger-zone";

export const resumeNotificationsRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Resume notifications and queue every event that waited while they were paused.",
    path: "/resume",
    responses: dangerResponses(
      z.object({ requeuedEvents: z.number() }),
      "Resumed",
    ),
  },
  handler: async c => {
    const result = await resumeNotifications(c);
    await auditDanger(c, "resumed");

    return c.json(result);
  },
});
