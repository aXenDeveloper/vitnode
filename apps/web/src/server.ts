import handler from '@tanstack/react-start/server-entry'
import { withPageCache } from '@vitnode/core/tanstack/page-cache/server'
import { withSeo } from '@vitnode/core/tanstack/seo/server'

import { docsSitemapSource } from './docs/sitemap.server'
import { pageCacheBuildId, pageCacheRoutes } from './page-cache.gen'
import { sitemapManifest } from './sitemap-sources.gen'
import { vitNodeConfig } from './vitnode.config'
import { vitNodeServerConfig } from './vitnode.server.config'

// `withSeo` sits outside the page cache, so a cached page gets the same
// indexing policy as a fresh render.
export default withSeo(
  withPageCache(handler, {
    buildId: pageCacheBuildId,
    config: vitNodeConfig,
    routes: pageCacheRoutes,
  }),
  {
    config: vitNodeServerConfig,
    sitemap: sitemapManifest,
    sources: [docsSitemapSource],
  },
)
