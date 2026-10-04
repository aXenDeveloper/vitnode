import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { getNotificationsOverview } from "@/api/models/notifications/admin";
import { CONFIG_PLUGIN } from "@/config";
import { NOTIFICATION_EMAIL_MODES } from "@/lib/notifications/types";

const zodEmailMode = z.enum(NOTIFICATION_EMAIL_MODES);
const zodCounts = z.record(z.string(), z.number());

export const zodEditableNotificationSettings = z.object({
  digestHour: z.number().int().min(0).max(23),
  digestWeekday: z.number().int().min(0).max(6),
  emailCapPerHour: z.number().int().min(0).max(500),
  emailEnabled: z.boolean(),
});

export const zodNotificationGlobalSettings =
  zodEditableNotificationSettings.extend({ paused: z.boolean() });

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
              counts: z.object({
                customizedMembers: z.number(),
                inboxItems: z.number(),
                queuedEmails: z.number(),
                unreadItems: z.number(),
              }),
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
              workers: z.object({
                emailBatchSize: z.number(),
                emailConcurrency: z.number(),
                fanoutBatchSize: z.number(),
                retentionDays: z.number(),
              }),
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
                    allowInApp: z.boolean(),
                    allowPush: z.boolean(),
                    email: zodEmailMode.nullable(),
                    enabled: z.boolean(),
                    inApp: z.boolean().nullable(),
                    memberCanEdit: z.boolean(),
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
