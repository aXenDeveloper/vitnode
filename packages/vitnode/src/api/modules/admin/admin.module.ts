import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { advancedAdminModule } from "./advanced/advanced.admin.module";
import { dashboardAdminModule } from "./dashboard/dashboard.admin.module";
import { debugAdminModule } from "./debug/debug.admin.module";
import { filesAdminModule } from "./files/files.admin.module";
import { rolesAdminModule } from "./roles/roles.admin.module";
import { sendNotificationRoute } from "./routes/notifications.route";
import { sessionAdminRoute } from "./routes/session.route";
import { staffAdminModule } from "./staff/staff.admin.module";
import { usersAdminModule } from "./users/users.admin.module";

export const adminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "admin",
  routes: [sessionAdminRoute, sendNotificationRoute],
  modules: [
    usersAdminModule,
    rolesAdminModule,
    staffAdminModule,
    debugAdminModule,
    advancedAdminModule,
    filesAdminModule,
    dashboardAdminModule,
  ],
  cronJobs: [],
});
