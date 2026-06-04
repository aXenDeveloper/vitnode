import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { listRolesAdminRoute } from "./routes/list.route";
import { showRoleAdminRoute } from "./routes/show.route";

export const rolesAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "roles",
  routes: [listRolesAdminRoute, showRoleAdminRoute],
});
