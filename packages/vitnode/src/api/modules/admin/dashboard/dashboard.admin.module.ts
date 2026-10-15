import { buildModule } from "@/api/builders";

import { getDashboardLayoutAdminRoute } from "./routes/get-layout.route";
import { saveDashboardLayoutAdminRoute } from "./routes/save-layout.route";
import { saveDashboardWidgetSettingsAdminRoute } from "./routes/save-widget-settings.route";

export const dashboardAdminModule = buildModule({
  name: "dashboard",
  routes: [
    getDashboardLayoutAdminRoute,
    saveDashboardLayoutAdminRoute,
    saveDashboardWidgetSettingsAdminRoute,
  ],
});
