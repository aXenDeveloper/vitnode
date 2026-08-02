import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { getDashboardLayoutAdminRoute } from "./routes/get-layout.route";
import { saveDashboardLayoutAdminRoute } from "./routes/save-layout.route";
import { saveDashboardWidgetSettingsAdminRoute } from "./routes/save-widget-settings.route";

export const dashboardAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "dashboard",
  routes: [
    getDashboardLayoutAdminRoute,
    saveDashboardLayoutAdminRoute,
    saveDashboardWidgetSettingsAdminRoute,
  ],
});
