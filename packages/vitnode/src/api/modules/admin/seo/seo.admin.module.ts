import { buildModule } from "@/api/builders";

import {
  ogImagesSeoAdminRoute,
  previewOgImageSeoAdminRoute,
} from "./routes/og-images.route";

export const seoAdminModule = buildModule({
  name: "seo",
  routes: [ogImagesSeoAdminRoute, previewOgImageSeoAdminRoute],
});
