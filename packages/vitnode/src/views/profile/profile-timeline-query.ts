import { infiniteQueryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import type { SearchTimelineEntry } from "@/views/search/types";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import {
  SEARCH_FEED_PAGE_SIZE,
  SEARCH_QUERY_ROOT,
} from "@/views/search/search-feed-query";

/**
 * A member's profile timeline: what they wrote and the reactions they gave
 * (unless they hide them), newest first, from `GET /users/{userId}/timeline`.
 */
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
    getNextPageParam: (page: {
      pageInfo: { endCursor: null | string; hasNextPage: boolean };
    }) =>
      page.pageInfo.hasNextPage && page.pageInfo.endCursor
        ? page.pageInfo.endCursor
        : undefined,
    initialPageParam: null as null | string,
    queryFn: async ({ pageParam, signal }) => {
      const response = await fetcher({
        plugin: manifest.id,
        args: {
          params: { userId: String(userId) },
          query: {
            first: SEARCH_FEED_PAGE_SIZE,
            lang: locale,
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        },
        method: "get",
        module: "users",
        options: { signal },
        path: "/{userId}/timeline",
      });

      if (!response.ok) {
        throw new Error(
          `The users API answered ${response.status} for the timeline of user ${userId} (locale "${locale}", cursor ${pageParam ?? "none"}).`,
        );
      }

      const page = await response.json();

      return {
        edges: page.edges.flatMap((edge): SearchTimelineEntry[] => {
          if (edge.kind === "content") return [edge.item];

          return edge.kind === "reaction" ? [edge] : [];
        }),
        pageInfo: page.pageInfo,
      };
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
