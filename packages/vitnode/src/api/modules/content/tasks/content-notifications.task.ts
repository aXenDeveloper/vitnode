import { buildQueueTask } from "@/api/lib/queue";
import { CONTENT_QUEUE_TASK_NOTIFICATIONS } from "@/content/const";
import { processContentNotificationIntent } from "@/content/server/notifications/process";

export const contentNotificationsQueueTask = buildQueueTask({
  name: CONTENT_QUEUE_TASK_NOTIFICATIONS,
  description:
    "Turn a committed content operation into core notifications, or clean up after a deleted record. Idempotent per operation.",
  maxAttempts: 5,
  handler: async (c, payload) => {
    await processContentNotificationIntent(c, payload);
  },
});
