import type {
  SearchFeedPageFetcher,
  SearchFeedParams,
} from "@/views/search/search-feed-query";

import { fetcher } from "@/tanstack/fetcher";
import {
  searchFeedPageFetcher,
  searchFeedQueryKey,
  searchFeedQueryOptions,
} from "@/views/search/search-feed-query";

export const fetchSearchFeedPage: SearchFeedPageFetcher =
  searchFeedPageFetcher(fetcher);

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
