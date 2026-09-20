import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { buildPageLayoutRoutes } from "./page-layout-routes";

export const pagesModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "pages",
  routes: buildPageLayoutRoutes({ pluginId: CONFIG_PLUGIN.pluginId }),
});
