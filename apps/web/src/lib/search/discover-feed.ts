import type { SearchFeedPageArgs } from '@vitnode/core/views/search/search-feed-query'

import type { Locale } from '#/lib/i18n/shared'

import { DISCOVER_FEED_PARAMS } from '#/lib/search/discover-request'
import { feedQueryKey, feedQueryOptions } from '#/lib/search/feed'

/**
 * Discover, as the shared feed with Discover's parameters.
 *
 * Two bindings and no logic. What a feed page *is* - the request, the page size,
 * the cursor rule, what counts as a failure - comes from
 * `@vitnode/core/views/search/search-feed-query`; how it travels comes from
 * `#/lib/search/feed`, which every feed in this app shares. All that is left
 * here is which parameters this route browses with, and those live in
 * `discover-request.ts`.
 *
 * The named exports stay, because a loader, a component and a test all read
 * "the Discover feed" and none of them should have to know it is
 * `{ sort: 'newest' }`.
 */

/**
 * The cache entry one language's Discover feed lives in.
 *
 * Core's key, through this app's one binding of it - see `feedQueryKey`. A key
 * invented here would be a second entry holding the same feed.
 */
export const discoverFeedQueryKey = (locale: Locale) =>
  feedQueryKey({ locale, params: DISCOVER_FEED_PARAMS })

/** The Discover feed, as the one query definition every caller shares. */
export const discoverFeedQueryOptions = ({ locale }: { locale: Locale }) =>
  feedQueryOptions({ locale, params: DISCOVER_FEED_PARAMS })

export type { SearchFeedPageArgs }
