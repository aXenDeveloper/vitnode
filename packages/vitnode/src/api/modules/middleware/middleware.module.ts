import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { routeMiddleware } from "./route";

export const middlewareModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "middleware",
  routes: [routeMiddleware],
});
