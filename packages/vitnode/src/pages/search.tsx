import type { PluginRoutePageProps } from "@/routing";

import type { SearchRouteSearch } from "../tanstack/search/route-search";
import type { SearchRouteData } from "../tanstack/search/search-route";

import { defineRoute } from "../tanstack/plugin-routes";
import { loadSearchRoute } from "../tanstack/search/search-route";
import { SearchRouteContent } from "../tanstack/search/search-screen";

const SearchPage = ({
  loaderData,
}: PluginRoutePageProps<SearchRouteData, SearchRouteSearch>) => (
  <SearchRouteContent {...loaderData} />
);

export const route = defineRoute<SearchRouteData, SearchRouteSearch>({
  // `head` after `load`, always.
  load: async ({ context, search, t }) =>
    await loadSearchRoute({ ...context, search: search.search, t }),
  head: ({ loaderData }) => ({ robots: "index, follow", ...loaderData }),
});

export default SearchPage;
