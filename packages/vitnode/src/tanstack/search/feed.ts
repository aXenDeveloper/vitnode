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

export const fetchSearchFeedPage: SearchFeedPageFetcher = createIsomorphicFn()
  .server(fetchSearchFeedPageOnServer)
  .client(fetchSearchFeedPageInBrowser);

export const feedQueryKey = ({
  locale,
  params,
}: {
  locale: string;
  params: SearchFeedParams;
}) => searchFeedQueryKey({ locale, params });

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
