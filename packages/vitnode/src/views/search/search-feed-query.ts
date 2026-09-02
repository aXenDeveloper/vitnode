import { infiniteQueryOptions } from "@tanstack/react-query";

import type { searchModule } from "@/api/modules/search/search.module";

import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";

import type { SearchFeedPage } from "./types";

/**
 * The search feed, as one query definition.
 *
 * Everything about *fetching* a feed lives here and nowhere else: the request,
 * the page size, the cursor rule, what counts as a failure, and the cache entry
 * it all lands in. `SearchFeedContent` renders whatever this produces and owns
 * none of it.
 *
 * That split exists because the alternative was tried and does not hold. When
 * the component built its own `useInfiniteQuery` and a TanStack Start loader
 * built another, the two agreed on the cache *key* and on nothing else - so the
 * server-rendered first page came from one contract and every `fetchNextPage()`
 * after hydration came from a second one with a different cursor rule and no
 * status checking. A 400 arrived as `{ message }`, was read as a page, and the
 * feed silently rendered as empty. Sharing a key is not sharing a contract.
 *
 * The one thing deliberately *not* fixed here is the transport: a loader running
 * on a server and a component running in a browser cannot reach the API the same
 * way. So {@link searchFeedQueryOptions} takes a `fetchPage` and defaults it to
 * the browser's, which is the only one a shared component can assume.
 */

/** How many hits one page holds, wherever that page is fetched from. */
export const SEARCH_FEED_PAGE_SIZE = 20;

/**
 * Where a page starts. `null` is the first one, spelled as the *absence* of a
 * cursor rather than an empty one: the route's schema rejects `cursor=`
 * outright (`.min(1)`), so sending it empty would 400 the first page of every
 * visit.
 */
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

/**
 * The search module, as a value the fetchers can carry without pulling the API
 * into either bundle. The module is imported as a *type* only, so route
 * literals, methods and response schemas all still infer; `clientModule`
 * supplies the one field the fetcher reads at runtime.
 */
export const searchModuleRef = clientModule<typeof searchModule>(
  CONFIG_PLUGIN.pluginId,
);

export interface SearchFeedPageArgs {
  cursor: SearchFeedCursor;
  /**
   * The language the page is rendered in. Required rather than defaulted: a
   * feed that quietly falls back to the default locale is a Polish page full of
   * English posts, and nothing about the response says so.
   */
  locale: string;
  params: SearchFeedParams;
}

/**
 * One page of a feed, as the query string the API reads it from.
 *
 * `first` is a string because the query schema reads it off a query string, and
 * every optional key is omitted rather than set to `undefined` so it never
 * reaches the URL at all.
 */
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

/**
 * Refuses a response that is not a search page.
 *
 * The fetchers hand non-2xx responses back rather than throwing on them - a
 * rejected cursor is a 400, a rate-limited visitor a 429 - and `json()` would
 * happily parse either one's `{ message }` body. Read as a page it has no
 * `edges`, so the feed renders as empty: a failure that looks exactly like a
 * community with nothing in it. Query can only retry, report, or keep the last
 * good page if the promise actually rejects.
 *
 * A 500 never reaches here; `rawApiFetch` throws on those with the body
 * attached. A 429 does, *after* `fetcherClient` has already raised the
 * global rate-limit notice - so the visitor is told, and the query still fails
 * rather than appending an error object as a page.
 *
 * Takes a plain `Response` so the caller keeps its typed one: passing the typed
 * response in widens `ok` to a boolean and leaves `json()` alone.
 */
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
