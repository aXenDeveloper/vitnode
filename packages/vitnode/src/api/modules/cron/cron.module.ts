import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";
import { testCron } from "./cron/test.cron";
import { runCronRoute } from "./routes/cron.route";

export const cronModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "cron",
  routes: [runCronRoute],
  cronJobs: [testCron],
});
