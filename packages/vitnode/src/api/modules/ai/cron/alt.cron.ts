import { ALT_QUEUE, detectMissingAlt } from "@/api/lib/ai/alt";
import { buildCron } from "@/api/lib/cron";

import { processQueueTasks } from "../../queue/helpers/process-queue-tasks";

export const altDetectCron = buildCron({
  name: "ai-alt-detect",
  description: "Queue images that are missing ALT text in a site language",
  schedule: "0 * * * *",
  handler: async c => {
    await detectMissingAlt(c);
  },
});

export const aiQueueCron = buildCron({
  name: "ai-queue",
  description: "Process queued AI tasks (automatic ALT text)",
  schedule: "* * * * *",
  handler: async c => {
    await processQueueTasks(c, {
      // Paid model calls: keep the old pace of two tasks a minute, one at a
      // time, instead of draining the queue like the default worker does.
      batchSize: 2,
      concurrency: 1,
      maxBatches: 1,
      lockKey: "queue:process:ai",
      queues: [ALT_QUEUE],
    });
  },
});
