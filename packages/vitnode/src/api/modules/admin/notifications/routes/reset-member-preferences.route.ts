import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { resetMemberNotificationPreferences } from "@/api/models/notifications/danger";

import {
  auditDanger,
  canManageNotifications,
  dangerResponses,
} from "../lib/danger-zone";

export const resetMemberNotificationPreferencesRoute = buildRoute({
  adminStaffPermission: canManageNotifications,
  route: {
    method: "post",
    description:
      "Drop every member's own notification choices and digest schedule so they follow the installation defaults.",
    path: "/members/reset-preferences",
    responses: dangerResponses(z.object({ members: z.number() }), "Reset"),
  },
  handler: async c => {
    const result = await resetMemberNotificationPreferences(c);
    await auditDanger(c, "member_preferences_reset");

    return c.json(result);
  },
});
