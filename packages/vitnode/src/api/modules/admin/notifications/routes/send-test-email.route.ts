import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { queueNotificationTestEmail } from "@/api/models/notifications/admin";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

export const sendNotificationTestEmailRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.notifications.canManage,
  route: {
    method: "post",
    description:
      "Queue a test notification email to the signed-in administrator. It cannot be sent to anyone else.",
    path: "/test-email",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ deliveryId: z.number() }),
          },
        },
        description: "Queued",
      },
      400: { description: "Notification email is not configured" },
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const admin = c.get("admin")?.user;
    if (!admin) throw new HTTPException(403);

    return c.json(await queueNotificationTestEmail(c, admin.id));
  },
});
