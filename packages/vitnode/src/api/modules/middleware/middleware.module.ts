import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { routeMiddleware } from "./route";

export const middlewareModule = buildModule({
  name: "middleware",
  routes: [routeMiddleware],
});

export const middlewareModuleApi = middlewareModule.build(
  CONFIG_PLUGIN.pluginId,
);
