import type {
  SearchFeedPageArgs,
  SearchFeedPageFetcher,
} from '@vitnode/core/views/search/search-feed-query'

import { createIsomorphicFn } from '@tanstack/react-start'
import {
  fetchSearchFeedPageInBrowser,
  searchFeedQueryKey,
  searchFeedQueryOptions,
} from '@vitnode/core/views/search/search-feed-query'

import type { Locale } from '#/lib/i18n/shared'

import { DISCOVER_FEED_PARAMS } from '#/lib/search/discover-request'
import { fetchDiscoverFeedPageOnServer } from '#/server/discover-feed.server'

/**
 * The Discover feed, as this app's one query definition.
 *
 * Everything about *what* a feed page is - the request, the page size, the
 * cursor rule, what counts as a failure - comes from
 * `@vitnode/core/views/search/search-feed-query`, which is also what the mounted
 * `SearchFeedContent` runs. This module supplies only the two things core cannot
 * know: which parameters Discover browses with, and how to reach the API from a
 * server that is rendering a request.
 */

/**
 * The transport boundary, and the reason one query definition works in a loader
 * and in a component.
 *
 * Both branches call the Hono API directly - the server one from inside the
 * request being rendered, the browser one over the network to the same origin.
 * There is deliberately no `createServerFn` in between: a server function is a
 * `POST` back to this app that then calls Hono, so every scroll of the feed
 * would cost two round trips to fetch a public, anonymous read that the API is
 * already the boundary for.
 *
 * `createIsomorphicFn` is what makes that safe rather than merely tidy. The
 * Start compiler keeps only the branch belonging to the bundle it is building
 * and drops the other's import with it, so `discover-feed.server.ts` - and the
 * `server-only` marker at the top of it - never reaches the browser. The client
 * branch is core's own browser fetcher, so a hydrated page and a Next.js page
 * fetch through exactly the same code.
 *
 * Un-compiled (tests, plain Node) the stub falls back to the server branch,
 * which is the right default off a browser.
 */
const fetchDiscoverFeedPage: SearchFeedPageFetcher = createIsomorphicFn()
  .server(fetchDiscoverFeedPageOnServer)
  .client(fetchSearchFeedPageInBrowser)

/**
 * The cache entry one language's feed lives in.
 *
 * Core's key, not one of this app's devising. `SearchFeedContent` runs the
 * mounted `useInfiniteQuery` and stores its pages here; a key invented locally
 * would be a *second* entry holding the same feed, so the loader would fill one,
 * the component would miss the other, and every visit would render a skeleton
 * and fetch page one again from the browser.
 *
 * The locale is in it, which is the whole contract: `/discover` and
 * `/pl/discover` are two feeds over two sets of documents, so they get two
 * entries. A language switch changes the key rather than the value under it.
 */
export const discoverFeedQueryKey = (locale: Locale) =>
  searchFeedQueryKey({ locale, params: DISCOVER_FEED_PARAMS })

/**
 * The Discover feed, as the one query definition every caller shares.
 *
 *     loader:     context.queryClient.ensureInfiniteQueryData(options)
 *     component:  <SearchFeedContent queryOptions={options} />
 *     load more:  fetchNextPage()   // the same queryFn, cursor rule and checks
 *
 * No `initialData`. The loader has already put page one in the entry this key
 * names and the SSR pass dehydrates it, so passing it again would be a second
 * copy of the same bytes that can disagree with the first.
 *
 * No `staleTime` either. Freshness is whatever the API's own caching gives, plus
 * VitNode's client defaults (`refetchOnMount` and `refetchOnWindowFocus` both
 * off), so a hydrated feed is not refetched behind the reader. Deciding a cache
 * lifetime belongs to the caching stage, with the API and Redis in the same view.
 */
export const discoverFeedQueryOptions = ({ locale }: { locale: Locale }) =>
  searchFeedQueryOptions({
    fetchPage: fetchDiscoverFeedPage,
    locale,
    params: DISCOVER_FEED_PARAMS,
  })

export type { SearchFeedPageArgs }
