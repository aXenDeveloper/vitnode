import handler from "@tanstack/react-start/server-entry";
import { withPageCache } from "@vitnode/core/tanstack/page-cache/server";

import { pageCacheBuildId, pageCacheRoutes } from "@/page-cache.gen";
import { vitNodeConfig } from "@/vitnode.config";

// Serves pages whose route declares a `cache` policy from VitNode's HTML cache.
// Routes without one pass straight through.
export default withPageCache(handler, {
  buildId: pageCacheBuildId,
  config: vitNodeConfig,
  routes: pageCacheRoutes,
});
