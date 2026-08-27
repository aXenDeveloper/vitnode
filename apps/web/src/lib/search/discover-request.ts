import type { SearchFeedParams } from '@vitnode/core/views/search/search-feed-query'

/**
 * What the Discover feed *is*, with nothing about how it travels.
 *
 * Two constants and no logic. Building the request, checking the response,
 * deciding the next cursor and naming the cache entry all live in
 * `@vitnode/core/views/search/search-feed-query`, because the mounted feed
 * component does the same things and there must not be two answers - a loader
 * and a component that agree only on the cache key is exactly the bug this
 * module used to contain half of.
 */

/**
 * Discover is the *browse* feed: no term, newest first. A term search is a
 * different request with a different sort, and it is not this module's.
 */
export const DISCOVER_FEED_SORT = 'newest' as const

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
})
