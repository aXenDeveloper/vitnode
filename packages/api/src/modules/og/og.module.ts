import { buildModule } from "@/builders";

import { profileOgImageRoute } from "./routes/profile.route";
import { siteOgImageRoute } from "./routes/site.route";

/** Generated social cards (`og:image`) for the site and public profiles. */
export const ogModule = buildModule({
  name: "og",
  routes: [siteOgImageRoute, profileOgImageRoute],
});
