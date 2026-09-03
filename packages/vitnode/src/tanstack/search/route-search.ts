import type { SearchFeedParams } from "@/views/search/search-feed-query";

import {
  normalizeSearchTerm,
  searchFeedParamsFor,
} from "@/views/search/search-params";

export interface SearchRouteSearch {
  search?: string;
}

export const normalizeSearchRouteSearch = (
  input: Record<string, unknown>,
): SearchRouteSearch => {
  const search = normalizeSearchTerm(input.search);

  return search === undefined ? {} : { search };
};

export const searchRouteFeedParams = ({
  search,
}: SearchRouteSearch): SearchFeedParams => searchFeedParamsFor({ search });
