import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { createNavigationAdminRoute } from "./routes/create.route";
import { deleteNavigationAdminRoute } from "./routes/delete.route";
import { listNavigationAdminRoute } from "./routes/list.route";
import { presetsNavigationAdminRoute } from "./routes/presets.route";
import { reorderNavigationAdminRoute } from "./routes/reorder.route";
import { updateNavigationAdminRoute } from "./routes/update.route";

export const navigationAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "navigation",
  routes: [
    listNavigationAdminRoute,
    presetsNavigationAdminRoute,
    createNavigationAdminRoute,
    reorderNavigationAdminRoute,
    updateNavigationAdminRoute,
    deleteNavigationAdminRoute,
  ],
});
