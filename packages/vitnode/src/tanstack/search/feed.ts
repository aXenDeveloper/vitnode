import type { SearchFeedParams } from "@/views/search/search-feed-query";

import {
  fetchSearchFeedPage,
  searchFeedQueryKey,
  searchFeedQueryOptions,
} from "@/views/search/search-feed-query";
export { fetchSearchFeedPage } from "@/views/search/search-feed-query";

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
