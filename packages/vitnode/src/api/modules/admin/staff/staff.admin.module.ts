import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { listAdminsStaffAdminRoute } from "./routes/admins.route";
import { createStaffAdminRoute } from "./routes/create.route";
import { deleteStaffAdminRoute } from "./routes/delete.route";
import { listModeratorsStaffAdminRoute } from "./routes/moderators.route";
import { permissionCatalogStaffAdminRoute } from "./routes/permission-catalog.route";
import { showPermissionsStaffAdminRoute } from "./routes/show-permissions.route";
import { updatePermissionsStaffAdminRoute } from "./routes/update-permissions.route";

export const staffAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "staff",
  routes: [
    listModeratorsStaffAdminRoute,
    listAdminsStaffAdminRoute,
    permissionCatalogStaffAdminRoute,
    showPermissionsStaffAdminRoute,
    updatePermissionsStaffAdminRoute,
    createStaffAdminRoute,
    deleteStaffAdminRoute,
  ],
});
