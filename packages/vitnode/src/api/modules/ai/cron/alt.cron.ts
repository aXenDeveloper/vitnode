import { ALT_QUEUE, detectMissingAlt } from "@/api/lib/ai/alt";
import { buildCron } from "@/api/lib/cron";

import { processQueueTasks } from "../../queue/helpers/process-queue-tasks";

/**
 * Finds images still missing ALT text in a site language and queues them, in
 * bounded batches. The repair path for missed uploads and new languages.
 */
export const altDetectCron = buildCron({
  name: "ai-alt-detect",
  description: "Queue images that are missing ALT text in a site language",
  schedule: "0 * * * *",
  handler: async c => {
    await detectMissingAlt(c);
  },
});

/**
 * Works the AI queue on its own, two tasks at a time, under its own lock - so
 * slow model calls never hold up e-mails and other queue work.
 */
export const aiQueueCron = buildCron({
  name: "ai-queue",
  description: "Process queued AI tasks (automatic ALT text)",
  schedule: "* * * * *",
  handler: async c => {
    await processQueueTasks(c, {
      batchSize: 2,
      lockKey: "queue:process:ai",
      queues: [ALT_QUEUE],
    });
  },
});
