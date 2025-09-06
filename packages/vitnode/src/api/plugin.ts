import { CONFIG_PLUGIN } from "@/config";

import { buildApiPlugin } from "./lib/plugin";
import { adminModule } from "./modules/admin/admin.module";
import { cronModule } from "./modules/cron/cron.module";
import { middlewareModule } from "./modules/middleware/middleware.module";
import { usersModule } from "./modules/users/users.module";

export const newBuildPluginApiCore = buildApiPlugin({
  pluginId: CONFIG_PLUGIN.pluginId,
  modules: [middlewareModule, usersModule, adminModule, cronModule],
});
