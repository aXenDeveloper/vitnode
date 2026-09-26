import { infiniteQueryOptions } from "@tanstack/react-query";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { CONFIG_PLUGIN } from "@/config";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import {
  nextSearchFeedCursor,
  SEARCH_FEED_FIRST_PAGE,
  SEARCH_QUERY_ROOT,
  searchTimelineQuery,
} from "@/views/search/search-feed-query";

export const adminUserTimelineQueryOptions = ({
  adminUserId,
  locale,
  userId,
}: {
  adminUserId: AdminIdentity;
  locale: string;
  userId: number;
}) =>
  infiniteQueryOptions({
    getNextPageParam: nextSearchFeedCursor,
    initialPageParam: SEARCH_FEED_FIRST_PAGE,
    queryFn: async ({ pageParam, signal }) => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: {
          params: { id: String(userId) },
          query: searchTimelineQuery({ cursor: pageParam, locale }),
        },
        method: "get",
        module: "admin/users",
        options: { signal },
        path: "/{id}/timeline",
      });

      if (!response.ok) {
        throw new AdminRequestError(
          response.status,
          "a user timeline",
          `id=${userId}`,
        );
      }

      return await response.json();
    },
    queryKey: [
      ...SEARCH_QUERY_ROOT,
      "timeline",
      "admin",
      adminUserId,
      userId,
      locale,
    ] as const,
    staleTime: RECORD_STALE_TIME,
  });
