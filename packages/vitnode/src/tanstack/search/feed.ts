import { createIsomorphicFn } from "@tanstack/react-start";

import type {
  SearchFeedPageFetcher,
  SearchFeedParams,
} from "@/views/search/search-feed-query";

import {
  fetchSearchFeedPageInBrowser,
  searchFeedQueryKey,
  searchFeedQueryOptions,
} from "@/views/search/search-feed-query";

import { fetchSearchFeedPageOnServer } from "./server";

/**
 * The search feed, as one query definition, for a TanStack Start host.
 *
 * Everything about *what* a feed page is - the request, the page size, the
 * cursor rule, what counts as a failure, the cache entry it lands in - comes
 * from `@/views/search/search-feed-query`, which is also what the mounted
 * `SearchFeedContent` runs. This module supplies only the one thing that module
 * cannot know: how to reach the API from a server that is rendering a request.
 *
 * Every feed is built from here - `/discover` browsing newest-first, `/search`
 * with a term and filters, and whatever comes next - because they are the same
 * query with different parameters. A route that bound its own transport would be
 * a second definition of a feed that agreed with this one only until it didn't.
 */

/**
 * The transport boundary, and the reason one query definition works in a loader
 * and in a component.
 *
 * Both branches call the Hono API directly - the server one from inside the
 * request being rendered, the browser one over the network to the same origin.
 * There is deliberately no `createServerFn` in between: a server function is a
 * `POST` back to the app that then calls Hono, so every scroll of the feed and
 * every keystroke in the search box would cost two round trips to fetch a
 * public, anonymous read that the API is already the boundary for.
 *
 * `createIsomorphicFn` is what makes that safe rather than merely tidy. The
 * Start compiler keeps only the branch belonging to the bundle it is building
 * and drops the other's import with it, so `./server` - and the `server-only`
 * marker at the top of it - never reaches the browser. The client branch is the
 * shared browser fetcher, so a hydrated page and a Next.js page fetch through
 * exactly the same code. It is written out here rather than behind a shared
 * helper because the transform matches the *chained call*; see the note in
 * `../files/query`.
 *
 * Un-compiled (tests, plain Node) the stub falls back to the server branch,
 * which is the right default off a browser.
 */
export const fetchSearchFeedPage: SearchFeedPageFetcher = createIsomorphicFn()
  .server(fetchSearchFeedPageOnServer)
  .client(fetchSearchFeedPageInBrowser);

/**
 * The cache entry one feed lives in.
 *
 * The shared key, not one of a route's devising. `SearchFeedContent` runs the
 * mounted `useInfiniteQuery` and stores its pages here; a key invented locally
 * would be a *second* entry holding the same feed, so the loader would fill one,
 * the component would miss the other, and every visit would render a skeleton
 * and fetch page one again from the browser.
 *
 * The locale is in it, which is the whole contract: `/discover` and
 * `/pl/discover` are two feeds over two sets of documents, so they get two
 * entries. A language switch changes the key rather than the value under it.
 */
export const feedQueryKey = ({
  locale,
  params,
}: {
  locale: string;
  params: SearchFeedParams;
}) => searchFeedQueryKey({ locale, params });

/**
 * One feed, as the one query definition every caller shares.
 *
 *     loader:     context.queryClient.ensureInfiniteQueryData(options)
 *     component:  <SearchFeedContent queryOptions={options} />
 *     load more:  fetchNextPage()   // the same queryFn, cursor rule and checks
 *
 * No `initialData`. A route loader has already put page one in the entry this
 * key names and the SSR pass dehydrates it, so passing it again would be a
 * second copy of the same bytes that can disagree with the first.
 *
 * No `staleTime` either. Freshness is whatever the API's own caching gives, plus
 * VitNode's client defaults (`refetchOnMount` and `refetchOnWindowFocus` both
 * off), so a hydrated feed is not refetched behind the reader. Deciding a cache
 * lifetime belongs to the caching stage, with the API and Redis in the same
 * view.
 */
export const feedQueryOptions = ({
  locale,
  params,
}: {
  locale: string;
  params: SearchFeedParams;
}) =>
  searchFeedQueryOptions({
    fetchPage: fetchSearchFeedPage,
    locale,
    params,
  });
