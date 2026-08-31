import "@tanstack/react-start/server-only";

import type {
  SearchFeedPageArgs,
  SearchFeedPageFetcher,
} from "@/views/search/search-feed-query";

import {
  assertSearchFeedResponse,
  searchFeedRequest,
  searchModuleRef,
} from "@/views/search/search-feed-query";

import { fetcherServer } from "../fetcher/server";

/**
 * One page of a search feed, fetched during SSR.
 *
 * Every feed a host renders on the server comes through here - `/discover`
 * browsing newest-first, `/search` with a term - because they are one request
 * with different parameters. There is deliberately no per-route copy: the whole
 * point of `searchFeedRequest` is that the request is decided once.
 *
 * The request and the response check are the shared ones - the same two the
 * browser fetcher uses, so a page fetched here and a page fetched by
 * `fetchNextPage()` after hydration are the same request with the same failure
 * semantics. Only the *transport* is this module's, and it is the only part that
 * genuinely cannot be shared.
 *
 * `fetcherServer` rather than a bare `fetch`: it resolves the API origin from
 * the request being rendered - so a preview deployment calls its own hostname
 * rather than a configured one - and forwards the visitor's cookie, user agent
 * and `x-forwarded-for`. The feed itself is the same for everyone, but the API
 * reads those for the rate-limit bucket and the audit IP, and a render that
 * sends none of them puts every visitor in one bucket.
 *
 * Only ever reached through the isomorphic transport in `./feed`, which is what
 * keeps this module - and the `server-only` import above - out of the browser
 * bundle.
 */
export const fetchSearchFeedPageOnServer: SearchFeedPageFetcher = async (
  args: SearchFeedPageArgs,
) => {
  const response = await fetcherServer(
    searchModuleRef,
    searchFeedRequest(args),
  );

  assertSearchFeedResponse(response, args);

  return await response.json();
};
