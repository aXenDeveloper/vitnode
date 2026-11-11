import { buildModule } from "@/api/builders";

import { createRoleAdminRoute } from "./routes/create.route";
import { deleteRoleAdminRoute } from "./routes/delete.route";
import { listRolesAdminRoute } from "./routes/list.route";
import { showRoleAdminRoute } from "./routes/show.route";
import { updateRoleAdminRoute } from "./routes/update.route";

export const rolesAdminModule = buildModule({
  name: "roles",
  routes: [
    listRolesAdminRoute,
    showRoleAdminRoute,
    createRoleAdminRoute,
    updateRoleAdminRoute,
    deleteRoleAdminRoute,
  ],
});
