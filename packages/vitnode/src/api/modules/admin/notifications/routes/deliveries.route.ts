import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  listNotificationDeliveries,
  retryNotificationDelivery,
} from "@/api/models/notifications/admin";
import { CONFIG_PLUGIN } from "@/config";
import { core_notification_deliveries } from "@/database/notifications";

const zodDeliveryStatus = z.enum(
  core_notification_deliveries.status.enumValues,
);

export const listNotificationDeliveriesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "notifications", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Email delivery records, newest first. Recipients appear as user ids; addresses and content are never returned.",
    path: "/deliveries",
    request: {
      query: z.object({
        cursor: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        status: zodDeliveryStatus.optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(
                z.object({
                  attempts: z.number(),
                  availableAt: z.date(),
                  createdAt: z.date(),
                  id: z.number(),
                  itemCount: z.number(),
                  lastError: z.string().nullable(),
                  maxAttempts: z.number(),
                  mode: z.enum(core_notification_deliveries.mode.enumValues),
                  providerMessageId: z.string().nullable(),
                  sentAt: z.date().nullable(),
                  skipReason: z.string().nullable(),
                  status: zodDeliveryStatus,
                  type: z.string().nullable(),
                  updatedAt: z.date(),
                  userId: z.number(),
                }),
              ),
              nextCursor: z.number().nullable(),
            }),
          },
        },
        description: "Delivery records",
      },
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const { cursor, limit, status } = c.req.valid("query");

    return c.json(
      await listNotificationDeliveries(c, { beforeId: cursor, limit, status }),
    );
  },
});

export const retryNotificationDeliveryRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "notifications", permission: "can_manage" },
  route: {
    method: "post",
    description:
      "Retry a failed email delivery with the same idempotency key and the same notifications.",
    path: "/deliveries/{id}/retry",
    request: { params: z.object({ id: z.coerce.number().int().positive() }) },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ success: z.boolean() }) },
        },
        description: "Queued for retry",
      },
      403: { description: "Access Denied" },
      409: { description: "The delivery has not failed" },
    },
  },
  handler: async c => {
    await retryNotificationDelivery(c, c.req.valid("param").id);

    return c.json({ success: true });
  },
});
