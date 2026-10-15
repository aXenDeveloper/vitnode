import { buildModule } from "@/api/builders";
import { manifest } from "@/manifest";

import { buildPageLayoutRoutes } from "./page-layout-routes";

export const pagesModule = buildModule({
  name: "pages",
  routes: buildPageLayoutRoutes({ pluginId: manifest.id }),
});
