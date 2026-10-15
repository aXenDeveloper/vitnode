import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { listPluginsAdminRoute } from "./routes/list.route";

export const pluginsAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "plugins",
  routes: [listPluginsAdminRoute],
});
