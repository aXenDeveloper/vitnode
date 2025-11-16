import { buildModule } from "@vitnode/core/api/lib/module";


import { categoriesRoute } from "./routes/get.route";
import { testRoute } from "./test.route";

export const categoriesModule = buildModule({
  name: "categories",
  routes: [categoriesRoute, testRoute],
});
