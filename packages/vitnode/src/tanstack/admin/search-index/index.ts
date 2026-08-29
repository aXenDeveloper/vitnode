/**
 * `/admin/core/advanced/search` - the search index's health, for a TanStack
 * Start host.
 *
 *     ./query         one query definition, and the two mutations that make it
 *                     stale - each refreshing on success
 *     ./route-search  one parameter: the collections table's search box
 *     ./route         the screen: namespaces, permission, loader, component
 *     ./server        the SSR transport, reached only through `./query`
 *
 * `SearchIndexContent` and its three buttons are framework-free and imported
 * from `@/views/admin/views/core/advanced/search` by both applications; the two
 * frameworks differ only in what an action does after it succeeds.
 */
export {
  invalidateSearchIndex,
  searchIndexQuery,
  useSearchIndexActions,
} from "./query";
export type {
  AdminSearchIndexRouteData,
  AdminSearchIndexRouteProps,
} from "./route";
export {
  ADMIN_SEARCH_INDEX_NAMESPACES,
  AdminSearchIndexRouteContent,
  loadAdminSearchIndexRoute,
} from "./route";
export type {
  SearchIndexRouteSearch,
  UncheckedSearchIndexSearch,
} from "./route-search";
export {
  normalizeSearchIndexRouteSearch,
  searchIndexSearchFrom,
  searchIndexSearchParams,
} from "./route-search";

export type {
  ClearSearchCollection,
  RebuildSearchIndex,
  SearchIndexActions,
  SearchIndexMutationResult,
} from "@/views/admin/views/core/advanced/search/search-index-mutations";
export {
  clearSearchCollectionInBrowser,
  rebuildSearchIndexInBrowser,
} from "@/views/admin/views/core/advanced/search/search-index-mutations";
export type { SearchIndexStatus } from "@/views/admin/views/core/advanced/search/search-index-query";
export { searchIndexQueryKey } from "@/views/admin/views/core/advanced/search/search-index-query";
