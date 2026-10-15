import { buildModule } from "@/api/builders";

import { processQueueCron } from "./cron/process-queue.cron";
import { sendEmailQueueTask } from "./tasks/send-email.task";

export const queueModule = buildModule({
  name: "queue",
  routes: [],
  cronJobs: [processQueueCron],
  queueTasks: [sendEmailQueueTask],
});
