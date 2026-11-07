import { buildModule } from "@/api/builders";

import { activityLogsAdminModule } from "./activity-logs/activity-logs.admin.module";
import { advancedAdminModule } from "./advanced/advanced.admin.module";
import { aiAdminModule } from "./ai/ai.admin.module";
import { dashboardAdminModule } from "./dashboard/dashboard.admin.module";
import { debugAdminModule } from "./debug/debug.admin.module";
import { filesAdminModule } from "./files/files.admin.module";
import { notificationsAdminModule } from "./notifications/notifications.admin.module";
import { pluginsAdminModule } from "./plugins/plugins.admin.module";
import { reportReasonsAdminModule } from "./report-reasons/report-reasons.admin.module";
import { rolesAdminModule } from "./roles/roles.admin.module";
import { sendNotificationRoute } from "./routes/notifications.route";
import { sessionAdminRoute } from "./routes/session.route";
import { staffAdminModule } from "./staff/staff.admin.module";
import { usersAdminModule } from "./users/users.admin.module";
import { warningsAdminModule } from "./warnings/warnings.admin.module";

export const adminModule = buildModule({
  name: "admin",
  routes: [sessionAdminRoute, sendNotificationRoute],
  modules: [
    activityLogsAdminModule,
    aiAdminModule,
    usersAdminModule,
    rolesAdminModule,
    staffAdminModule,
    debugAdminModule,
    advancedAdminModule,
    filesAdminModule,
    dashboardAdminModule,
    notificationsAdminModule,
    pluginsAdminModule,
    reportReasonsAdminModule,
    warningsAdminModule,
  ],
  cronJobs: [],
});
