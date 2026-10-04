import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { getNotificationsOverview } from "@/api/models/notifications/admin";
import { CONFIG_PLUGIN } from "@/config";
import { NOTIFICATION_EMAIL_MODES } from "@/lib/notifications/types";

const zodEmailMode = z.enum(NOTIFICATION_EMAIL_MODES);
const zodCounts = z.record(z.string(), z.number());

export const zodNotificationGlobalSettings = z.object({
  emailBatchSize: z.number().int().min(1).max(500),
  emailConcurrency: z.number().int().min(1).max(20),
  emailEnabled: z.boolean(),
  fanoutBatchSize: z.number().int().min(10).max(5000),
  retentionDays: z.number().int().min(1).max(3650),
});

export const getNotificationsOverviewRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "notifications", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Registered notification types, installation settings and delivery health. Aggregates only - no content or recipients.",
    path: "/overview",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.object({
                adapterConfigured: z.boolean(),
                enabled: z.boolean(),
              }),
              health: z.object({
                cronActive: z.boolean(),
                cronStale: z.boolean(),
                deliveries: zodCounts,
                events: zodCounts,
                oldestPendingEventAt: z.date().nullable(),
                queue: zodCounts,
              }),
              settings: zodNotificationGlobalSettings,
              types: z.array(
                z.object({
                  category: z.string(),
                  defaults: z.object({
                    email: zodEmailMode,
                    inApp: z.boolean(),
                  }),
                  emailAvailable: z.boolean(),
                  emailSupported: z.boolean(),
                  grouped: z.boolean(),
                  id: z.string(),
                  label: z.string(),
                  mandatory: z.boolean(),
                  pluginId: z.string(),
                  policy: z.object({
                    allowEmail: z.boolean(),
                    email: zodEmailMode.nullable(),
                    enabled: z.boolean(),
                    inApp: z.boolean().nullable(),
                  }),
                  version: z.number(),
                }),
              ),
            }),
          },
        },
        description: "Notifications overview",
      },
      403: { description: "Access Denied" },
    },
  },
  handler: async c => c.json(await getNotificationsOverview(c)),
});
