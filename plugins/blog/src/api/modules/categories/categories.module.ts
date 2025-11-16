import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import { categoriesRoute } from "./routes/get.route";
import { testRoute } from "./test.route";

export const categoriesModule = buildModule({
  name: "categories",
  routes: [categoriesRoute, testRoute],
});

export const categoriesModuleApi = categoriesModule.build(
  CONFIG_PLUGIN.pluginId,
);
