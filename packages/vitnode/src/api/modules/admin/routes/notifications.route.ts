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
