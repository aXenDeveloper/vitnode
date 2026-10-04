import { processQueueTasksByIds } from "@/api/modules/queue/helpers/process-queue-tasks";

import type { NotificationsContext } from "./shared";

export const runQueuedTasksNow = async (
  c: NotificationsContext,
  queueIds: number[],
): Promise<void> => {
  await processQueueTasksByIds(c, queueIds);
};
