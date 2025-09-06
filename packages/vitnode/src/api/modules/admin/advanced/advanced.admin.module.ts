import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";
import { cronAdminModule } from "./cron/cron.admin.module";

export const advancedAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "advanced",
  routes: [],
  modules: [cronAdminModule],
});
