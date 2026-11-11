import { z } from "zod";

import { buildQueueTask } from "@/api/builders";
import {
  QUEUE_NOTIFICATIONS_CLEANUP,
  QUEUE_NOTIFICATIONS_EMAIL,
  QUEUE_NOTIFICATIONS_FANOUT,
} from "@/api/models/notifications/shared";

export const notificationsFanoutTask = buildQueueTask({
  name: QUEUE_NOTIFICATIONS_FANOUT,
  payload: z.object({ eventId: z.number().int().positive() }),
  description:
    "Deliver a notification event to its recipients in bounded batches.",
  maxAttempts: 10,
  handler: async (c, { eventId }): Promise<void> => {
    const { processNotificationEvent } =
      await import("../../../models/notifications/fanout");
    const result = await processNotificationEvent(c, eventId);

    if (!result.done) {
      await c
        .get("queue")
        .dispatch(notificationsFanoutTask, { eventId }, { priority: 10 });
    }
  },
});

export const notificationsEmailTask = buildQueueTask({
  name: QUEUE_NOTIFICATIONS_EMAIL,
  payload: z.object({}),
  description: "Send due notification emails and digests.",
  maxAttempts: 5,
  handler: async c => {
    const { drainNotificationEmails } =
      await import("../../../models/notifications/email");
    await drainNotificationEmails(c);
  },
});

export const notificationsCleanupTask = buildQueueTask({
  name: QUEUE_NOTIFICATIONS_CLEANUP,
  payload: z.object({}),
  description: "Remove notifications older than the retention period.",
  maxAttempts: 3,
  handler: async c => {
    const { runNotificationCleanup } =
      await import("../../../models/notifications/maintenance");
    await runNotificationCleanup(c);
  },
});
