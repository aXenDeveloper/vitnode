import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";

import type { SearchFeedParams } from "./search-feed-query";

import { SEARCH_QUERY_ROOT } from "./search-feed-query";

const facetsQuery = ({
  locale,
  params,
}: {
  locale: string;
  params: SearchFeedParams;
}): Record<string, string> => {
  const query: Record<string, string> = { lang: locale };

  if (params.search) query.search = params.search;
  if (params.authorIds) query.authorIds = params.authorIds;
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;

  return query;
};

export const searchFacetsQueryOptions = ({
  locale,
  params,
}: {
  locale: string;
  params: SearchFeedParams;
}) => {
  const query = facetsQuery({ locale, params });

  return queryOptions({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { query },
        method: "get",
        module: "search",
        options: { signal },
        path: "/facets",
      });

      if (!response.ok) {
        throw new Error(
          `The search API answered ${response.status} for the type counts.`,
        );
      }

      return await response.json();
    },
    queryKey: [...SEARCH_QUERY_ROOT, "facets", query] as const,
    staleTime: RECORD_STALE_TIME,
  });
};

export const searchAuthorsQueryOptions = ({ term }: { term: string }) =>
  queryOptions({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { query: term ? { search: term } : {} },
        method: "get",
        module: "search",
        options: { signal },
        path: "/authors",
      });

      if (!response.ok) {
        throw new Error(
          `The search API answered ${response.status} for the author lookup.`,
        );
      }

      return await response.json();
    },
    queryKey: [...SEARCH_QUERY_ROOT, "authors", term] as const,
    staleTime: RECORD_STALE_TIME,
  });
