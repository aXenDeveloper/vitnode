import '@tanstack/react-start/server-only'
import type {
  SearchFeedPageArgs,
  SearchFeedPageFetcher,
} from '@vitnode/core/views/search/search-feed-query'

import {
  assertSearchFeedResponse,
  searchFeedRequest,
  searchModuleRef,
} from '@vitnode/core/views/search/search-feed-query'

import { fetcherServer } from '#/server/fetcher.server'

/**
 * One page of the Discover feed, fetched during SSR.
 *
 * The request and the response check are core's - the same two the browser
 * fetcher uses, so a page fetched here and a page fetched by `fetchNextPage()`
 * after hydration are the same request with the same failure semantics. Only
 * the *transport* is this module's, and it is the only part that genuinely
 * cannot be shared.
 *
 * `fetcherServer` rather than a bare `fetch`: it resolves the API origin from
 * the request being rendered - so a preview deployment calls its own hostname
 * rather than a configured one - and forwards the visitor's cookie, user agent
 * and `x-forwarded-for`. The feed itself is the same for everyone, but the API
 * reads those for the rate-limit bucket and the audit IP, and a render that
 * sends none of them puts every visitor in one bucket.
 *
 * Only ever reached through the isomorphic transport in
 * `#/lib/search/discover-feed`, which is what keeps this module - and the
 * `server-only` import above - out of the browser bundle.
 */
export const fetchDiscoverFeedPageOnServer: SearchFeedPageFetcher = async (
  args: SearchFeedPageArgs,
) => {
  const response = await fetcherServer(searchModuleRef, searchFeedRequest(args))

  assertSearchFeedResponse(response, args)

  return await response.json()
}
