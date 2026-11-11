import { buildModule } from "@/api/builders";

import { activityLogsAdminModule } from "./activity-logs/activity-logs.module";
import { advancedAdminModule } from "./advanced/advanced.module";
import { aiAdminModule } from "./ai/ai.module";
import { dashboardAdminModule } from "./dashboard/dashboard.module";
import { debugAdminModule } from "./debug/debug.module";
import { filesAdminModule } from "./files/files.module";
import { notificationsAdminModule } from "./notifications/notifications.module";
import { pluginsAdminModule } from "./plugins/plugins.module";
import { reportReasonsAdminModule } from "./report-reasons/report-reasons.module";
import { rolesAdminModule } from "./roles/roles.module";
import { sendNotificationRoute } from "./routes/send-notification.route";
import { sessionAdminRoute } from "./routes/session.route";
import { staffAdminModule } from "./staff/staff.module";
import { usersAdminModule } from "./users/users.module";
import { warningsAdminModule } from "./warnings/warnings.module";

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
