import { buildModule } from "@/api/builders";
import { manifest } from "@/manifest";

import { buildShowPageLayoutRoute } from "./routes/show-layout.route";
import { buildUpdatePageLayoutRoute } from "./routes/update-layout.route";

export const buildPageLayoutRoutes = <P extends string>({
  pluginId,
}: {
  pluginId: P;
}) => [
  buildShowPageLayoutRoute({ pluginId }),
  buildUpdatePageLayoutRoute({ pluginId }),
];

export const pagesModule = buildModule({
  name: "pages",
  routes: buildPageLayoutRoutes({ pluginId: manifest.id }),
});
