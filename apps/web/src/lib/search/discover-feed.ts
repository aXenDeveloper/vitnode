import type { SearchFeedPage } from '@vitnode/core/views/search/types'

import { infiniteQueryOptions } from '@tanstack/react-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { fetcherClient } from '@vitnode/core/lib/fetcher-client'
import { searchFeedQueryKey } from '@vitnode/core/views/search/search-feed-content'

import type { Locale } from '#/lib/i18n/shared'
import type {
  DiscoverFeedCursor,
  DiscoverFeedPageArgs,
} from '#/lib/search/discover-request'

import {
  assertDiscoverFeedResponse,
  DISCOVER_FEED_PARAMS,
  discoverFeedRequest,
  searchModuleRef,
} from '#/lib/search/discover-request'
import { fetchDiscoverFeedPageOnServer } from '#/server/discover-feed.server'

/**
 * One page of the Discover feed, fetched from the browser.
 *
 * `fetcherClient` is the browser's half of the same fetcher: it builds the same
 * `/api/@vitnode/core/search` URL - same-origin, because `CONFIG.api` falls back
 * to the origin the document was served from - lets the browser attach the
 * visitor's cookies itself, and routes a 429 to the rate-limit notice every
 * other VitNode client call gets.
 */
export const fetchDiscoverFeedPageInBrowser = async (
  args: DiscoverFeedPageArgs,
): Promise<SearchFeedPage> => {
  const response = await fetcherClient(
    searchModuleRef,
    discoverFeedRequest(args),
  )

  assertDiscoverFeedResponse(response, args)

  return await response.json()
}

/**
 * The transport boundary, and the reason the same query definition works in a
 * loader and in a component.
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
 * `server-only` marker at the top of it - never reaches the browser. Un-compiled
 * (tests, plain Node) the stub falls back to the server branch, which is the
 * right default off a browser.
 */
const fetchDiscoverFeedPage = createIsomorphicFn()
  .server(fetchDiscoverFeedPageOnServer)
  .client(fetchDiscoverFeedPageInBrowser)

/**
 * The first page carries no cursor. Named rather than inlined, because it is
 * also the value a test has to hand `getNextPageParam` to stand in for "this is
 * page one".
 */
export const DISCOVER_FEED_FIRST_PAGE: DiscoverFeedCursor = null

/**
 * The cache entry one language's feed lives in.
 *
 * The locale is *in the key*, and that is the whole contract: `/discover` and
 * `/pl/discover` are two feeds over two sets of documents, so they get two
 * entries. A key without it serves whichever language happened to be fetched
 * first, and a language switch - which changes the key rather than the value
 * under it - would show the previous one.
 *
 * ## Why it delegates rather than naming its own key
 *
 * `SearchFeedContent` runs its own `useInfiniteQuery`, and `searchFeedQueryKey`
 * is the entry it reads and writes - core exports it precisely so a prefetching
 * framework can warm it. A key of this app's own devising would be a *second*
 * entry holding the same feed: the loader would fill one, the component would
 * miss the other, and every visit would render a skeleton and fetch page one
 * again from the browser. Two keys for one feed is not a cosmetic duplication;
 * it is the SSR guarantee silently gone.
 *
 * So the key comes from core and the *transport* comes from here. That split is
 * exactly what core documents: the params-and-locale key is shared, the
 * `queryFn` is not, because a loader on the server cannot reach the API the way
 * the browser does.
 *
 * `DISCOVER_FEED_PARAMS` is a single module-level object for the same reason -
 * see the note on it.
 */
export const discoverFeedQueryKey = (locale: Locale) =>
  searchFeedQueryKey({ locale, params: DISCOVER_FEED_PARAMS })

/**
 * Where the next page starts, or nothing when this was the last one.
 *
 * Two conditions rather than one. `hasNextPage` is the API's answer and is
 * authoritative, but the newest-first walk cursors by row id, so an `endCursor`
 * of `null` means there is no row to continue from - asking anyway would replay
 * page one forever. Returning `undefined` is what tells Query the feed has
 * ended, which is what turns the "load more" button off.
 */
export const nextDiscoverFeedCursor = (
  page: SearchFeedPage,
): DiscoverFeedCursor | undefined => {
  const { endCursor, hasNextPage } = page.pageInfo

  if (!hasNextPage || endCursor === null) return undefined

  return String(endCursor)
}

/**
 * The Discover feed, as the one query definition every caller shares.
 *
 * A route loader warms it before the component renders:
 *
 *     loader: ({ context }) =>
 *       context.queryClient.ensureInfiniteQueryData(
 *         discoverFeedQueryOptions({ locale: context.locale }),
 *       )
 *
 * and the component reads the very same options back:
 *
 *     useSuspenseInfiniteQuery(discoverFeedQueryOptions({ locale }))
 *
 * Same key, same page function, same pagination - so the loader's page is the
 * page the component renders, `fetchNextPage` continues from it, and no route
 * has to implement paging a second time.
 *
 * No `staleTime`. The Next.js version cached this feed with `"use cache"` and
 * `cacheLife("minutes")`; none of that is ported, deliberately. Freshness here
 * is whatever the API's own caching gives, plus VitNode's client defaults
 * (`refetchOnMount` and `refetchOnWindowFocus` both off), so a hydrated feed is
 * not refetched behind the reader. Deciding a cache lifetime belongs to the
 * caching stage, with the API and Redis in the same view.
 */
export const discoverFeedQueryOptions = ({ locale }: { locale: Locale }) =>
  infiniteQueryOptions({
    getNextPageParam: nextDiscoverFeedCursor,
    initialPageParam: DISCOVER_FEED_FIRST_PAGE,
    queryFn: async ({ pageParam }) =>
      await fetchDiscoverFeedPage({ cursor: pageParam, locale }),
    queryKey: discoverFeedQueryKey(locale),
  })
