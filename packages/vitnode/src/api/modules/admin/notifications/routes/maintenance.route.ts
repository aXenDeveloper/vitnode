import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  queueNotificationTestEmail,
  reconcileNotifications,
} from "@/api/models/notifications/admin";
import { CONFIG_PLUGIN } from "@/config";

export const sendNotificationTestEmailRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "notifications", permission: "can_manage" },
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

export const reconcileNotificationCountsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "notifications", permission: "can_manage" },
  route: {
    method: "post",
    description:
      "Compare stored unread counts with the inbox and, unless dryRun, fix the ones that drifted.",
    path: "/reconcile",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              dryRun: z.boolean().default(true),
              userId: z.number().int().positive().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ corrected: z.number(), mismatched: z.number() }),
          },
        },
        description: "Reconciliation result",
      },
      403: { description: "Access Denied" },
    },
  },
  handler: async c =>
    c.json(await reconcileNotifications(c, c.req.valid("json"))),
});
