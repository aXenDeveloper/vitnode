import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { listAdminsStaffAdminRoute } from "./routes/admins.route";
import { listModeratorsStaffAdminRoute } from "./routes/moderators.route";

export const staffAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "staff",
  routes: [listModeratorsStaffAdminRoute, listAdminsStaffAdminRoute],
});
