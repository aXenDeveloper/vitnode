import "@tanstack/react-start/server-only";

import type { SearchFeedPageArgs } from "@/views/search/search-feed-query";

import { searchModule } from "@/api/modules/search/search.module";
import {
  assertSearchFeedResponse,
  searchFeedQuery,
} from "@/views/search/search-feed-query";

import { fetcher } from "../fetcher/server";

export const fetchSearchFeedPageOnServer = async (args: SearchFeedPageArgs) => {
  const response = await fetcher(searchModule, {
    args: { query: searchFeedQuery(args) },
    method: "get",
    module: "search",
    path: "/",
  });

  assertSearchFeedResponse(response, args);

  return await response.json();
};
