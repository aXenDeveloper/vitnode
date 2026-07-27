import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import { aiTestRoute } from "./ai-test.route";
import { categoriesRoute } from "./routes/get.route";
import { testRoute } from "./test.route";

export const categoriesModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "categories",
  routes: [categoriesRoute, testRoute, aiTestRoute],
});
