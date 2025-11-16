import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { cronAdminModule } from "./cron/cron.admin.module";

export const advancedAdminModule = buildModule({
  name: "advanced",
  routes: [],
  modules: [cronAdminModule],
});

export const advancedAdminModuleApi = advancedAdminModule.build(
  CONFIG_PLUGIN.pluginId,
);
