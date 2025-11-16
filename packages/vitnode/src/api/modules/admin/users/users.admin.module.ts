import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { listUsersAdminRoute } from "./routes/list.route";

export const usersAdminModule = buildModule({
  name: "users",
  routes: [listUsersAdminRoute],
});

export const usersAdminModuleApi = usersAdminModule.build(
  CONFIG_PLUGIN.pluginId,
);
