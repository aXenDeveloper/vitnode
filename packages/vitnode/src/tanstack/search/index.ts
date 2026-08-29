export {
  DISCOVER_FEED_PARAMS,
  DISCOVER_FEED_SORT,
  discoverFeedQueryKey,
  discoverFeedQueryOptions,
} from "./discover";
export type {
  DiscoverLoaderContext,
  DiscoverRouteData,
} from "./discover-route";
export {
  DISCOVER_NAMESPACES,
  DiscoverRouteContent,
  loadDiscoverRoute,
} from "./discover-route";
export { feedQueryKey, feedQueryOptions, fetchSearchFeedPage } from "./feed";
export type { SearchRouteSearch } from "./route-search";
export {
  normalizeSearchRouteSearch,
  searchRouteFeedParams,
} from "./route-search";
export type { SearchLoaderContext, SearchRouteData } from "./search-route";
export {
  loadSearchRoute,
  SEARCH_NAMESPACES,
  SearchRouteContent,
} from "./search-route";

/**
 * `/search` and `/discover`, as everything a TanStack Start route needs.
 *
 * One architecture, not two. The feed's *behaviour* - the request, the page
 * size, the cursor rule, what counts as a failure, the cache key, and the
 * `SearchFeedContent` that renders it - is already shared and lives under
 * `@vitnode/core/views/search`. What this namespace adds is the half only a
 * TanStack Start host can run:
 *
 * - `./feed` binds the isomorphic transport, so one query definition works in a
 *   loader and in a component.
 * - `./discover` is that feed with Discover's two constants.
 * - `./route-search` is the URL contract of `/search`, pure and router-free.
 *
 * The keys are re-exported from here rather than from `views/search/
 * search-feed-query`, so a route reaches for one place and cannot invent a
 * second entry holding the same feed.
 */
export type {
  SearchFeedCursor,
  SearchFeedPageArgs,
  SearchFeedPageFetcher,
  SearchFeedParams,
  SearchFeedQueryOptions,
} from "@/views/search/search-feed-query";
export { SEARCH_FEED_PAGE_SIZE } from "@/views/search/search-feed-query";
export type { SearchSort } from "@/views/search/search-params";
export {
  MAX_SEARCH_TERM_LENGTH,
  MIN_SEARCH_TERM_LENGTH,
  normalizeSearchTerm,
  searchFeedParamsFor,
} from "@/views/search/search-params";
