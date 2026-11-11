import { buildCron } from "@/api/lib/cron";

import { processQueueTasks } from "../lib/process-queue-tasks";

export const processQueueCron = buildCron({
  name: "process-queue",
  description: "Process pending database queue tasks",
  schedule: "* * * * *",
  handler: async c => {
    await processQueueTasks(c);
  },
});
