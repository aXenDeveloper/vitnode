import { buildModule } from "@/api/builders";

import { listAdminsStaffAdminRoute } from "./routes/admins.route";
import { createStaffAdminRoute } from "./routes/create.route";
import { deleteStaffAdminRoute } from "./routes/delete.route";
import { listModeratorsStaffAdminRoute } from "./routes/moderators.route";
import { permissionCatalogStaffAdminRoute } from "./routes/permission-catalog.route";
import { scopeResourcesStaffAdminRoute } from "./routes/scope-resources.route";
import { showPermissionsStaffAdminRoute } from "./routes/show-permissions.route";
import { updatePermissionsStaffAdminRoute } from "./routes/update-permissions.route";

export const staffAdminModule = buildModule({
  name: "staff",
  routes: [
    listModeratorsStaffAdminRoute,
    listAdminsStaffAdminRoute,
    permissionCatalogStaffAdminRoute,
    scopeResourcesStaffAdminRoute,
    showPermissionsStaffAdminRoute,
    updatePermissionsStaffAdminRoute,
    createStaffAdminRoute,
    deleteStaffAdminRoute,
  ],
});
