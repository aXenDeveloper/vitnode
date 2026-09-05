export {
  invalidateSearchIndex,
  searchIndexQuery,
  useSearchIndexActions,
} from "./query";
export type { AdminSearchIndexRouteData } from "./route";
export {
  ADMIN_SEARCH_INDEX_NAMESPACES,
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
export type { AdminSearchIndexRouteProps } from "./screen";
export { AdminSearchIndexRouteContent } from "./screen";

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
