import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { aiQueueCron, altDetectCron } from "./cron/alt.cron";
import { aiMaintenanceCron } from "./cron/maintenance.cron";
import { aiFeedbackRoute } from "./routes/feedback.route";
import { aiHistoryRoute } from "./routes/history.route";
import { runAiRoute } from "./routes/run.route";
import { aiUsageRoute } from "./routes/usage.route";
import { altGenerateQueueTask } from "./tasks/alt-generate.task";

export const aiModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "ai",
  routes: [aiUsageRoute, aiHistoryRoute, aiFeedbackRoute, runAiRoute],
  cronJobs: [aiMaintenanceCron, altDetectCron, aiQueueCron],
  queueTasks: [altGenerateQueueTask],
});
