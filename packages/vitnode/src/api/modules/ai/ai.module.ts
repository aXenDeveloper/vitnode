import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { aiMaintenanceCron } from "./cron/maintenance.cron";
import { aiFeedbackRoute } from "./routes/feedback.route";
import { aiHistoryRoute } from "./routes/history.route";
import { runAiRoute } from "./routes/run.route";
import { aiUsageRoute } from "./routes/usage.route";

export const aiModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "ai",
  routes: [aiUsageRoute, aiHistoryRoute, aiFeedbackRoute, runAiRoute],
  cronJobs: [aiMaintenanceCron],
});
