import type { SearchFeedParams } from "@/views/search/search-feed-query";

import {
  normalizeSearchTerm,
  searchFeedParamsFor,
} from "@/views/search/search-params";

/**
 * What a `/search` route reads out of its URL, and what it turns that into.
 *
 * Two pure functions, no transport and no React, so the route's contract can be
 * stated and tested without a router: `route-search.test.ts` beside this file is
 * the whole of it.
 *
 * Both delegate to `@/views/search/search-params`, which is where the meaning of
 * a search request lives - the same module the Next.js `SearchView` reads its
 * `searchParams` through. `/search?search=hello` is therefore the same request
 * in both applications rather than two hand-written approximations of it.
 */

/**
 * The one search parameter this route has.
 *
 * `search` is in the URL because a search has to be shareable and because a
 * crawler landing on `/search?search=hello` should be served those results. The
 * sort and the type filters are **not**: they are controls the visitor drives
 * after the page has loaded, they have never been in the URL, and putting them
 * there means deciding what a canonical search URL is and whether every
 * keystroke is a history entry. That is a product question, not a move.
 */
export interface SearchRouteSearch {
  search?: string;
}

/**
 * The route's search schema - written as a function rather than a schema object
 * because its job is to *normalise*, not to reject.
 *
 * A search page is the one page whose query string is typed by strangers.
 * `?search=` arrives empty, `?search=a&search=b` arrives as an array,
 * `?search=<40KB>` arrives as a denial-of-service attempt on the full-text
 * index - and every one of them should render the search page, not an error
 * boundary. `normalizeSearchTerm` answers all three: anything that is not a
 * usable term becomes no term at all, which is the browse feed.
 *
 * A missing term is returned as an *absent* key rather than
 * `{ search: undefined }`, so the router has nothing to write back into the URL
 * and `/search?search=%20` settles as `/search`.
 */
export const normalizeSearchRouteSearch = (
  input: Record<string, unknown>,
): SearchRouteSearch => {
  const search = normalizeSearchTerm(input.search);

  return search === undefined ? {} : { search };
};

/**
 * The route's search parameters, as the shared feed's own.
 *
 * The sort is not passed and is not missing: `searchFeedParamsFor` derives it
 * from whether there is a term - relevance when there is one, newest when there
 * is not - which is the rule the controls then start from and the rule the
 * Next.js page has always applied.
 *
 * With no term this is `{ sort: 'newest' }`, which is exactly
 * `DISCOVER_FEED_PARAMS`. That is deliberate: `/search` with an empty box and
 * `/discover` are the same request over the same documents, so they share one
 * cache entry rather than fetching it twice.
 */
export const searchRouteFeedParams = ({
  search,
}: SearchRouteSearch): SearchFeedParams => searchFeedParamsFor({ search });
