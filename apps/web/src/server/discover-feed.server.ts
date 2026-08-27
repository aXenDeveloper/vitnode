import '@tanstack/react-start/server-only'
import type { SearchFeedPage } from '@vitnode/core/views/search/types'

import type { DiscoverFeedPageArgs } from '#/lib/search/discover-request'

import {
  assertDiscoverFeedResponse,
  discoverFeedRequest,
  searchModuleRef,
} from '#/lib/search/discover-request'
import { fetcherServer } from '#/server/fetcher.server'

/**
 * One page of the Discover feed, fetched during SSR.
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
export const fetchDiscoverFeedPageOnServer = async (
  args: DiscoverFeedPageArgs,
): Promise<SearchFeedPage> => {
  const response = await fetcherServer(
    searchModuleRef,
    discoverFeedRequest(args),
  )

  assertDiscoverFeedResponse(response, args)

  return await response.json()
}
