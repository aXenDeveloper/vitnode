import { infiniteQueryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import type { SearchResultItem } from "@/views/search/types";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import {
  SEARCH_FEED_PAGE_SIZE,
  SEARCH_QUERY_ROOT,
} from "@/views/search/search-feed-query";

/** The Content tab's query key, by member, language and filter (`null` = All). */
export const profileContentQueryKey = ({
  locale,
  type,
  userId,
}: {
  locale: string;
  type: null | string;
  userId: number;
}) =>
  [
    ...SEARCH_QUERY_ROOT,
    "timeline",
    "content",
    userId,
    locale,
    type ?? "all",
  ] as const;

/**
 * A member's Content tab: what they authored, newest first, as a guest sees
 * it, from `GET /users/{userId}/timeline?kind=content`. `type` narrows it to
 * one content type. Cards come back in the search feed's item shape, so the
 * timeline cards render them unchanged.
 */
export const profileContentQueryOptions = ({
  locale,
  type,
  userId,
}: {
  locale: string;
  type: null | string;
  userId: number;
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
            kind: "content",
            lang: locale,
            ...(type ? { type } : {}),
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
          `The users API answered ${response.status} for the content of user ${userId} (type "${type ?? "all"}", locale "${locale}", cursor ${pageParam ?? "none"}).`,
        );
      }

      const page = await response.json();

      return {
        edges: page.edges.flatMap((edge): SearchResultItem[] =>
          edge.kind === "authored"
            ? [
                {
                  ...edge.item,
                  author: edge.item.authors[0] ?? null,
                  authorId: edge.item.authors[0]?.id ?? null,
                  containerId: null,
                  containerType: null,
                  id: 0,
                  isHidden: false,
                  isPublic: true,
                  score: null,
                },
              ]
            : [],
        ),
        pageInfo: page.pageInfo,
      };
    },
    queryKey: profileContentQueryKey({ locale, type, userId }),
    staleTime: RECORD_STALE_TIME,
  });
