import { buildModule } from "@/builders";

import { robotsPreviewAdminRoute } from "./routes/robots-preview.route";
import { showSeoSettingsAdminRoute } from "./routes/show.route";
import { updateSeoSettingsAdminRoute } from "./routes/update.route";

export const seoAdminModule = buildModule({
  name: "seo",
  routes: [
    showSeoSettingsAdminRoute,
    updateSeoSettingsAdminRoute,
    robotsPreviewAdminRoute,
  ],
});
