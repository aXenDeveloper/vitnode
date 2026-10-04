import { z } from "zod";

import { buildCron } from "@/api/lib/cron";
import { buildQueueTask } from "@/api/lib/queue";
import { drainNotificationEmails } from "@/api/models/notifications/email";
import { processNotificationEvent } from "@/api/models/notifications/fanout";
import {
  runNotificationCleanup,
  runNotificationSchedule,
} from "@/api/models/notifications/maintenance";
import {
  NOTIFICATIONS_PLUGIN_ID,
  QUEUE_NOTIFICATIONS_CLEANUP,
  QUEUE_NOTIFICATIONS_EMAIL,
  QUEUE_NOTIFICATIONS_FANOUT,
} from "@/api/models/notifications/shared";

const fanoutPayloadSchema = z.object({ eventId: z.number().int().positive() });

export const notificationsFanoutTask = buildQueueTask({
  name: QUEUE_NOTIFICATIONS_FANOUT,
  description:
    "Deliver a notification event to its recipients in bounded batches.",
  maxAttempts: 10,
  handler: async (c, payload) => {
    const { eventId } = fanoutPayloadSchema.parse(payload);
    const result = await processNotificationEvent(c, eventId);

    // Out of time with recipients left: progress is saved on the event, so a
    // fresh task picks up at the next batch.
    if (!result.done) {
      await c.get("queue").dispatch({
        name: QUEUE_NOTIFICATIONS_FANOUT,
        payload: { eventId },
        pluginId: NOTIFICATIONS_PLUGIN_ID,
        priority: 10,
      });
    }
  },
});

export const notificationsEmailTask = buildQueueTask({
  name: QUEUE_NOTIFICATIONS_EMAIL,
  description: "Send due notification emails and digests.",
  maxAttempts: 5,
  handler: async c => {
    await drainNotificationEmails(c);
  },
});

export const notificationsCleanupTask = buildQueueTask({
  name: QUEUE_NOTIFICATIONS_CLEANUP,
  description: "Remove notifications older than the retention period.",
  maxAttempts: 3,
  handler: async c => {
    await runNotificationCleanup(c);
  },
});

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
