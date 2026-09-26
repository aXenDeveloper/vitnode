import { infiniteQueryOptions } from "@tanstack/react-query";

import { CONFIG_PLUGIN } from "@/config";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import {
  nextSearchFeedCursor,
  SEARCH_FEED_FIRST_PAGE,
  SEARCH_QUERY_ROOT,
  searchTimelineQuery,
} from "@/views/search/search-feed-query";

export const profileTimelineQueryOptions = ({
  locale,
  userId,
  viewerId,
}: {
  locale: string;
  userId: number;
  viewerId: null | number;
}) =>
  infiniteQueryOptions({
    getNextPageParam: nextSearchFeedCursor,
    initialPageParam: SEARCH_FEED_FIRST_PAGE,
    queryFn: async ({ pageParam, signal }) => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: {
          params: { userId: String(userId) },
          query: searchTimelineQuery({ cursor: pageParam, locale }),
        },
        method: "get",
        module: "search",
        options: { signal },
        path: "/timeline/{userId}",
      });

      if (!response.ok) {
        throw new Error(
          `The search API answered ${response.status} for the timeline of user ${userId} (locale "${locale}", cursor ${pageParam ?? "none"}).`,
        );
      }

      return await response.json();
    },
    queryKey: [
      ...SEARCH_QUERY_ROOT,
      "timeline",
      "public",
      viewerId,
      userId,
      locale,
    ] as const,
    staleTime: RECORD_STALE_TIME,
  });
