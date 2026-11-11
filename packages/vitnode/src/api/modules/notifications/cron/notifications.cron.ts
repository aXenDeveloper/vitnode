import { buildCron } from "@/api/lib/cron";
import { runNotificationSchedule } from "@/api/models/notifications/maintenance";
import {
  NOTIFICATIONS_PLUGIN_ID,
  QUEUE_NOTIFICATIONS_CLEANUP,
} from "@/api/models/notifications/shared";

export const notificationsScheduleCron = buildCron({
  name: "notifications-schedule",
  description:
    "Plan notification digests, recover stalled deliveries and drain email.",
  schedule: "*/5 * * * *",
  handler: async c => {
    await runNotificationSchedule(c);
  },
});

export const notificationsCleanupCron = buildCron({
  name: "notifications-cleanup",
  description: "Queue the daily notification retention cleanup.",
  schedule: "0 2 * * *",
  handler: async c => {
    await c.get("queue").dispatch({
      name: QUEUE_NOTIFICATIONS_CLEANUP,
      pluginId: NOTIFICATIONS_PLUGIN_ID,
    });
  },
});
