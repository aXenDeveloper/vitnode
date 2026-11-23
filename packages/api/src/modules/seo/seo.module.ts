import { buildModule } from "@/builders";

import { robotsRoute } from "./routes/robots.route";
import { sitemapFileRoute, sitemapIndexRoute } from "./routes/sitemap.route";

/** `robots.txt` and the XML sitemaps the web app serves at its root. */
export const seoModule = buildModule({
  name: "seo",
  routes: [robotsRoute, sitemapIndexRoute, sitemapFileRoute],
});
