import { buildModule } from "@/builders";

import { showSiteStatusAdminRoute } from "./routes/show.route";
import { updateSiteStatusAdminRoute } from "./routes/update.route";

export const siteAdminModule = buildModule({
  name: "site",
  routes: [showSiteStatusAdminRoute, updateSiteStatusAdminRoute],
});
