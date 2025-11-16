import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { cleanCron } from "./cron/clean.cron";
import { runCronRoute } from "./routes/cron.route";

export const cronModule = buildModule({
  name: "cron",
  routes: [runCronRoute],
  cronJobs: [cleanCron],
});

export const cronModuleApi = cronModule.build(CONFIG_PLUGIN.pluginId);
