import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { aiQueueCron, altDetectCron } from "./cron/alt.cron";
import { aiMaintenanceCron } from "./cron/maintenance.cron";
import { availableAiActionsRoute } from "./routes/available.route";
import { aiFeedbackRoute } from "./routes/feedback.route";
import { aiHistoryRoute } from "./routes/history.route";
import { runAiRoute } from "./routes/run.route";
import { estimateAiRoute, streamAiRoute } from "./routes/stream.route";
import { aiUsageRoute } from "./routes/usage.route";
import { altGenerateQueueTask } from "./tasks/alt-generate.task";

export const aiModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "ai",
  routes: [
    aiUsageRoute,
    aiHistoryRoute,
    aiFeedbackRoute,
    runAiRoute,
    availableAiActionsRoute,
    streamAiRoute,
    estimateAiRoute,
  ],
  cronJobs: [aiMaintenanceCron, altDetectCron, aiQueueCron],
  queueTasks: [altGenerateQueueTask],
});
