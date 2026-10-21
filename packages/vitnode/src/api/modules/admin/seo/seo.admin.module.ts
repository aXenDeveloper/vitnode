import { buildModule } from "@/api/builders";

import {
  listOgImageTemplatesAdminRoute,
  previewOgImageAdminRoute,
} from "./routes/og-images.routes";

export const seoAdminModule = buildModule({
  name: "seo",
  routes: [listOgImageTemplatesAdminRoute, previewOgImageAdminRoute],
});
