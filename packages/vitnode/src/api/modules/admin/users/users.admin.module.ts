import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { listUsersAdminRoute } from "./routes/list.route";

export const usersAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "users",
  routes: [listUsersAdminRoute],
});
