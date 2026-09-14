import type { PluginRouteTranslator } from "@/routing";

import type { QueryClient } from "@tanstack/react-query";

import type { SearchFeedParams } from "@/views/search/search-feed-query";

import { feedQueryOptions } from "./feed";
import { searchRouteFeedParams } from "./route-search";

export { SEARCH_NAMESPACES } from "./namespaces";

/** The narrowest slice of a route's context this loader reads. */
export interface SearchLoaderContext {
  locale: string;
  queryClient: QueryClient;
}

/** What {@link loadSearchRoute} returns, and therefore what `head` receives. */
export interface SearchRouteData {
  description: string;
  params: SearchFeedParams;
  title: string;
}

export const loadSearchRoute = async ({
  locale,
  queryClient,
  search,
  t,
}: SearchLoaderContext & {
  search?: string;
  t: PluginRouteTranslator;
}): Promise<SearchRouteData> => {
  const params = searchRouteFeedParams({ search });

  await queryClient.infiniteQuery({
    ...feedQueryOptions({ locale, params }),
    staleTime: "static",
  });

  return {
    description: t("core.search.desc"),
    params,
    title: t("core.search.title"),
  };
};
