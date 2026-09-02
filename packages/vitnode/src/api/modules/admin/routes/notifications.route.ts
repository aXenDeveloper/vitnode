import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { notificationsChannel } from "@/ws/notifications";

export const zodSendNotificationSchema = z.object({
  description: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  type: z.enum(["error", "info", "success", "warning"]).optional(),
  userId: z.number(),
});

export const sendNotificationRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  // The send-notification dashboard widget is the only caller, and its sibling
  // (`PUT /admin/dashboard/widget-settings`) is gated the same way. Without a
  // declaration the route asked only for *an* admin session, so an
  // administrator restricted to one unrelated screen could still push arbitrary
  // titles and bodies to any user id - a message that arrives inside the
  // product, wearing the product's own notification UI.
  adminStaffPermission: { module: "dashboard", permission: "can_edit" },
  route: {
    method: "post",
    description: "Send a notification to a user",
    path: "/notifications/send",
    request: {
      body: {
        content: {
          "application/json": {
            schema: zodSendNotificationSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean() }),
          },
        },
        description: "Notification sent",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: c => {
    const admin = c.get("admin")?.user;
    if (!admin) throw new HTTPException(403);

    const { userId, title, description, type } = c.req.valid("json");

    // Delivered only to that user's connections, across all their browsers.
    c.get("realtime").sendToUser(userId, notificationsChannel, {
      description,
      title,
      type,
    });

    return c.json({ success: true });
  },
});
