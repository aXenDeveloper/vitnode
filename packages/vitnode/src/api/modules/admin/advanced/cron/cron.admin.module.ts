import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";
import { getCronsRoute } from "./routes/get.route";
import { runCronRoute } from "./routes/run.route";

export const cronAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "cron",
  routes: [getCronsRoute, runCronRoute],
});
