import { infiniteQueryOptions } from "@tanstack/react-query";

import type { searchModule } from "@/api/modules/search/search.module";

import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";

import type { SearchFeedPage } from "./types";

/** How many hits one page holds, wherever that page is fetched from. */
export const SEARCH_FEED_PAGE_SIZE = 20;

export type SearchFeedCursor = null | string;

/** The first page carries no cursor. Named, because a test has to say so too. */
export const SEARCH_FEED_FIRST_PAGE: SearchFeedCursor = null;

export interface SearchFeedParams {
  authorId?: string;
  from?: string;
  search?: string;
  sort?: "newest" | "oldest" | "relevance";
  to?: string;
  types?: string;
}

export const searchModuleRef = clientModule<typeof searchModule>(
  CONFIG_PLUGIN.pluginId,
);

export interface SearchFeedPageArgs {
  cursor: SearchFeedCursor;

  locale: string;
  params: SearchFeedParams;
}

export const searchFeedQuery = ({
  cursor,
  locale,
  params,
}: SearchFeedPageArgs): Record<string, string> => {
  const query: Record<string, string> = {
    first: String(SEARCH_FEED_PAGE_SIZE),
    lang: locale,
  };

  if (params.search) query.search = params.search;
  if (params.types) query.types = params.types;
  if (params.authorId) query.authorId = params.authorId;
  if (params.sort) query.sort = params.sort;
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  if (cursor !== null) query.cursor = cursor;

  return query;
};

export const assertSearchFeedResponse = (
  response: Response,
  { cursor, locale }: SearchFeedPageArgs,
): void => {
  if (response.ok) return;

  throw new Error(
    `The search API answered ${response.status} for the feed (locale "${locale}", cursor ${cursor ?? "none"}).`,
  );
};

/**
 * Where the next page starts, or nothing when this was the last one.
 *
 * Two conditions rather than one. `hasNextPage` is the API's answer and is
 * authoritative, but the newest-first walk cursors by row id, so an `endCursor`
 * of `null` means there is no row to continue from - asking anyway would send
 * `cursor=null` as a literal string and replay page one forever. Returning
 * `undefined` is what tells Query the feed has ended, which is what turns the
 * "load more" button off.
 */
export const nextSearchFeedCursor = (
  page: SearchFeedPage,
): SearchFeedCursor | undefined => {
  const { endCursor, hasNextPage } = page.pageInfo;

  if (!hasNextPage || endCursor === null) return undefined;

  return String(endCursor);
};

/**
 * The cache entry one feed reads and writes.
 *
 * `params` before `locale` is the order it has always been in; changing it
 * would silently orphan every entry a running client already holds. The locale
 * is *in* the key, and that is the whole contract: `/discover` and
 * `/pl/discover` are two feeds over two sets of documents, so they get two
 * entries.
 *
 * An object in a key is safe - Query hashes keys structurally rather than by
 * identity - but only while it holds the same values, so a caller with fixed
 * parameters should keep one module-level object rather than a literal per
 * render.
 */
export const searchFeedQueryKey = ({
  locale,
  params,
}: {
  locale: string;
  params: SearchFeedParams;
}) => ["search", params, locale] as const;

/**
 * How a page is actually fetched. See {@link searchFeedQueryOptions}.
 *
 * The second argument is the read's cancellation, and it is optional so the SSR
 * branch - handed no signal, deliberately - satisfies this with one parameter.
 */
export type SearchFeedPageFetcher = (
  args: SearchFeedPageArgs,
  options?: { signal?: AbortSignal },
) => Promise<SearchFeedPage>;

/**
 * One page, fetched from the browser.
 *
 * `fetcherClient` builds the same `/api/@vitnode/core/search` URL every other
 * VitNode client call uses - same-origin, cookies attached by the browser
 * itself, and a 429 routed to the global rate-limit notice.
 */
export const fetchSearchFeedPageInBrowser: SearchFeedPageFetcher = async (
  args,
  { signal } = {},
) => {
  const response = await fetcherClient(searchModuleRef, {
    args: { query: searchFeedQuery(args) },
    method: "get",
    module: "search",
    options: { signal },
    path: "/",
  });

  assertSearchFeedResponse(response, args);

  return await response.json();
};

/**
 * The feed, as the one query definition every caller shares.
 *
 * A route loader warms it before the component renders:
 *
 *     context.queryClient.ensureInfiniteQueryData(searchFeedQueryOptions({...}))
 *
 * and the component reads the very same options back:
 *
 *     <SearchFeedContent queryOptions={searchFeedQueryOptions({...})} />
 *
 * Same key, same page function, same cursor rule - so the loader's page is the
 * page the component renders, `fetchNextPage` continues from it under the same
 * status checking, and no route implements paging a second time.
 *
 * `fetchPage` is the seam. It defaults to the browser's fetcher, which is what
 * a Next.js client component wants and what a hydrated TanStack page wants too;
 * an app that also fetches during SSR passes one that can do both. It is a
 * plain async function rather than anything framework-shaped, so nothing about
 * this module knows which framework is rendering it.
 *
 * `initialData` is for a server that already has page one in hand and no cache
 * to put it in - Next.js renders the feed from a Server Component and passes it
 * down. A framework that hydrates a real Query cache must **not** use it: the
 * page is already in the entry this key names, and passing it again is a second
 * copy of the same bytes that can disagree with the first.
 *
 * No `staleTime`. Freshness is whatever the API's own caching gives, plus
 * VitNode's client defaults (`refetchOnMount` and `refetchOnWindowFocus` both
 * off), so a hydrated feed is not refetched behind the reader.
 */
export const searchFeedQueryOptions = ({
  fetchPage = fetchSearchFeedPageInBrowser,
  initialData,
  locale,
  params,
}: {
  fetchPage?: SearchFeedPageFetcher;
  initialData?: SearchFeedPage;
  locale: string;
  params: SearchFeedParams;
}) =>
  infiniteQueryOptions({
    getNextPageParam: nextSearchFeedCursor,
    initialData: initialData
      ? { pageParams: [SEARCH_FEED_FIRST_PAGE], pages: [initialData] }
      : undefined,
    initialPageParam: SEARCH_FEED_FIRST_PAGE,
    // Reads `signal`, which is the only thing that marks a query cancellable:
    // a re-typed search term leaves one request in flight rather than one per
    // keystroke. `assertSearchFeedResponse` throws on a refusal and the abort
    // rejects earlier still, inside `fetch`, so neither can reach the feed as
    // "no results" - which is what a search that found nothing looks like.
    queryFn: async ({ pageParam, signal }) =>
      await fetchPage({ cursor: pageParam, locale, params }, { signal }),
    queryKey: searchFeedQueryKey({ locale, params }),
    /**
     * {@link RECORD_STALE_TIME} - a feed changes when somebody publishes, which
     * is an edit like any other, just made by a stranger rather than a colleague.
     *
     * This is the definition `feedQueryOptions` and therefore Discover both
     * delegate to, so the window covers `/search` and `/discover` at once - which
     * is the point of there being one definition.
     *
     * Only the *first* page carries it in practice: `fetchNextPage` appends and
     * is driven by the reader, and a revalidation of an infinite query refetches
     * the pages already loaded rather than resetting the list somebody is part
     * way down.
     */
    staleTime: RECORD_STALE_TIME,
  });

/**
 * What {@link SearchFeedContent} accepts, and the reason it accepts only this.
 *
 * Typed as the factory's own return type on purpose: a caller cannot hand the
 * feed a hand-rolled options object that happens to type-check, so "one query
 * definition" is enforced by the compiler rather than by review.
 */
export type SearchFeedQueryOptions = ReturnType<typeof searchFeedQueryOptions>;
