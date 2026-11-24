import handler from "@tanstack/react-start/server-entry";
import { withPageCache } from "@vitnode/core/tanstack/page-cache/server";
import { withSeo } from "@vitnode/core/tanstack/seo/server";

import { pageCacheBuildId, pageCacheRoutes } from "@/page-cache.gen";
import { sitemapManifest } from "@/sitemap-sources.gen";
import { vitNodeConfig } from "@/vitnode.config";
import { vitNodeServerConfig } from "@/vitnode.server.config";

// Serves pages whose route declares a `cache` policy from VitNode's HTML cache.
// Routes without one pass straight through. `withSeo` wraps it, so cached and
// fresh pages get the same indexing policy, and it serves `/robots.txt` and
// `/sitemap.xml` from `seo` in `vitnode.server.config.ts`.
export default withSeo(
  withPageCache(handler, {
    buildId: pageCacheBuildId,
    config: vitNodeConfig,
    routes: pageCacheRoutes,
  }),
  { config: vitNodeServerConfig, sitemap: sitemapManifest },
);
