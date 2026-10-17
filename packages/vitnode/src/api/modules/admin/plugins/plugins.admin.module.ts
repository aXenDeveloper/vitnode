import { buildModule } from "@/api/builders";

import { checkPluginUpdatesAdminRoute } from "./routes/check-updates.route";
import { listPluginsAdminRoute } from "./routes/list.route";
import { pluginUpdatesAdminRoute } from "./routes/updates.route";

export const pluginsAdminModule = buildModule({
  name: "plugins",
  routes: [
    listPluginsAdminRoute,
    pluginUpdatesAdminRoute,
    checkPluginUpdatesAdminRoute,
  ],
});
