import { queryOptions } from "@tanstack/react-query";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";

import { SEARCH_QUERY_ROOT } from "./search-feed-query";

const SEARCH_SUGGESTIONS_LIMIT = 6;
export const SEARCH_SUGGEST_MIN_LENGTH = 2;
export const SEARCH_SUGGEST_DEBOUNCE_MS = 150;

const POPULAR_STALE_TIME = 5 * 60 * 1000;

export type SearchPopularitySignal = "click" | "view";

export const searchSuggestQueryOptions = ({
  locale,
  term,
}: {
  locale: string;
  term: string;
}) =>
  queryOptions({
    queryFn: async ({ signal }) => {
      const response = await fetcher({
        plugin: manifest.id,
        args: {
          query: {
            first: String(SEARCH_SUGGESTIONS_LIMIT),
            lang: locale,
            search: term,
          },
        },
        method: "get",
        module: "search",
        options: { credentials: "include", signal },
        path: "/suggest",
      });

      if (!response.ok) {
        throw new Error(
          `The search API answered ${response.status} for suggestions.`,
        );
      }

      return (await response.json()).items;
    },
    queryKey: [...SEARCH_QUERY_ROOT, "suggest", locale, term] as const,
    staleTime: RECORD_STALE_TIME,
  });

export const searchPopularQueryOptions = ({ locale }: { locale: string }) =>
  queryOptions({
    queryFn: async ({ signal }) => {
      const response = await fetcher({
        plugin: manifest.id,
        args: {
          query: { first: String(SEARCH_SUGGESTIONS_LIMIT), lang: locale },
        },
        method: "get",
        module: "search",
        options: { signal },
        path: "/popular",
      });

      if (!response.ok) {
        throw new Error(
          `The search API answered ${response.status} for popular content.`,
        );
      }

      return (await response.json()).items;
    },
    queryKey: [...SEARCH_QUERY_ROOT, "popular", locale] as const,
    staleTime: POPULAR_STALE_TIME,
  });

export const recordSearchPopularity = async (input: {
  itemId: string;
  itemType: string;
  signal: SearchPopularitySignal;
}): Promise<void> => {
  await fetcher({
    plugin: manifest.id,
    args: { body: input },
    method: "post",
    module: "search",
    options: { credentials: "include", keepalive: true },
    path: "/popularity",
  }).catch(() => undefined);
};
