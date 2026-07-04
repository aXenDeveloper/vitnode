import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { processQueueCron } from "./cron/process-queue.cron";
import { sendEmailQueueTask } from "./tasks/send-email.task";

export const queueModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "queue",
  routes: [],
  cronJobs: [processQueueCron],
  queueTasks: [sendEmailQueueTask],
});
