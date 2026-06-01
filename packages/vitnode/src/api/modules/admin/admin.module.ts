import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { advancedAdminModule } from "./advanced/advanced.admin.module";
import { debugAdminModule } from "./debug/debug.admin.module";
import { sendNotificationRoute } from "./routes/notifications.route";
import { sessionAdminRoute } from "./routes/session.route";
import { usersAdminModule } from "./users/users.admin.module";

export const adminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "admin",
  routes: [sessionAdminRoute, sendNotificationRoute],
  modules: [usersAdminModule, debugAdminModule, advancedAdminModule],
  cronJobs: [],
});
