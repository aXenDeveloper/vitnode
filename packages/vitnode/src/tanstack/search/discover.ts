import type { SearchFeedParams } from "@/views/search/search-feed-query";

import { feedQueryKey, feedQueryOptions } from "./feed";

/**
 * Discover, as the shared feed with Discover's parameters.
 *
 * Two constants and two bindings, no logic. What a feed page *is* - the request,
 * the page size, the cursor rule, what counts as a failure - comes from
 * `@/views/search/search-feed-query`; how it travels comes from `./feed`, which
 * every feed shares. All that is left here is which parameters this route
 * browses with.
 *
 * The named exports stay, because a loader, a component and a test all read "the
 * Discover feed" and none of them should have to know it is `{ sort: 'newest' }`.
 */

/**
 * Discover is the *browse* feed: no term, newest first. A term search is a
 * different request with a different sort, and it is not this module's.
 */
export const DISCOVER_FEED_SORT = "newest" as const;

/**
 * Discover, as the shared feed's own parameters.
 *
 * One frozen module-level object, read by both halves of the route: the loader
 * builds its cache key from it and `<SearchFeedContent>` is handed a query built
 * from the same reference. Query hashes keys structurally, so an equal object
 * would do - but one object makes it impossible for the two to drift.
 *
 * `search` is absent rather than empty: Discover browses, it does not query.
 */
export const DISCOVER_FEED_PARAMS: SearchFeedParams = Object.freeze({
  sort: DISCOVER_FEED_SORT,
});

/**
 * The cache entry one language's Discover feed lives in.
 *
 * The shared key, through the one binding of it - see `feedQueryKey`. A key
 * invented here would be a second entry holding the same feed.
 */
export const discoverFeedQueryKey = (locale: string) =>
  feedQueryKey({ locale, params: DISCOVER_FEED_PARAMS });

/** The Discover feed, as the one query definition every caller shares. */
export const discoverFeedQueryOptions = ({ locale }: { locale: string }) =>
  feedQueryOptions({ locale, params: DISCOVER_FEED_PARAMS });
