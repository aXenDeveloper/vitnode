import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { advancedAdminModule } from "./advanced/advanced.admin.module";
import { aiAdminModule } from "./ai/ai.admin.module";
import { dashboardAdminModule } from "./dashboard/dashboard.admin.module";
import { debugAdminModule } from "./debug/debug.admin.module";
import { filesAdminModule } from "./files/files.admin.module";
import { navigationAdminModule } from "./navigation/navigation.admin.module";
import { notificationsAdminModule } from "./notifications/notifications.admin.module";
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
    aiAdminModule,
    usersAdminModule,
    rolesAdminModule,
    staffAdminModule,
    debugAdminModule,
    advancedAdminModule,
    filesAdminModule,
    dashboardAdminModule,
    navigationAdminModule,
    notificationsAdminModule,
  ],
  cronJobs: [],
});
