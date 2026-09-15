import type { QueryClient } from "@tanstack/react-query";

import type { PluginRouteTranslator } from "@/routing";

import { discoverFeedQueryOptions } from "./discover";

export { DISCOVER_NAMESPACES } from "./namespaces";

/** The narrowest slice of a route's context this loader reads. */
export interface DiscoverLoaderContext {
  locale: string;
  queryClient: QueryClient;
}

/** What {@link loadDiscoverRoute} returns, and therefore what `head` receives. */
export interface DiscoverRouteData {
  description: string;
  title: string;
}

export const loadDiscoverRoute = async ({
  locale,
  queryClient,
  t,
}: DiscoverLoaderContext & {
  t: PluginRouteTranslator;
}): Promise<DiscoverRouteData> => {
  await queryClient.infiniteQuery({
    ...discoverFeedQueryOptions({ locale }),
    staleTime: "static",
  });

  return {
    description: t("core.search.discoverDesc"),
    title: t("core.search.discoverTitle"),
  };
};
