import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import { categoriesRoute } from "./routes/get.route";
import { testRoute } from "./test.route";

export const categoriesModule = buildModule({
  ...CONFIG_PLUGIN,
  name: "categories",
  routes: [categoriesRoute, testRoute],
});
