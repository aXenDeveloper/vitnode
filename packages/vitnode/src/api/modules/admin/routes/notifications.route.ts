import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { adminMessageNotification } from "@/api/lib/notifications/core-types";
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
    description:
      "Send a notification to a user: a toast on their open tabs and an entry in their inbox",
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
  handler: async c => {
    const admin = c.get("admin")?.user;
    if (!admin) throw new HTTPException(403);

    const { userId, title, description, type } = c.req.valid("json");

    // The toast this route always sent, unchanged: delivered only to that
    // user's open connections, across all their browsers.
    c.get("realtime").sendToUser(userId, notificationsChannel, {
      description,
      title,
      type,
    });

    // New: the same message is kept in their inbox, so a user who was offline
    // (or closed the toast) still sees it. Each send is its own message.
    await c.get("notifications").publish({
      type: adminMessageNotification,
      actorId: admin.id,
      allowSelf: true,
      recipients: [userId],
      data: { description, title },
      idempotencyKey: `admin-message:${crypto.randomUUID()}`,
    });

    return c.json({ success: true });
  },
});
