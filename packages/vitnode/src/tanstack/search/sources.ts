import type { LucideIcon } from "lucide-react";

import { queryOptions } from "@tanstack/react-query";

export interface SearchSourceItem {
  color?: string;
  context?: null | string;
  excerpt?: null | string;
  icon?: string;
  id: string;
  title: string;
  url: string;
}

export interface SearchSourceQuery {
  locale: string;
  signal: AbortSignal;
  term: string;
}

export interface SearchSource {
  icon: LucideIcon;
  id: string;
  labelKey: string;
  namespace: string;
  search: (query: SearchSourceQuery) => Promise<SearchSourceItem[]>;
}

const SEARCH_SOURCE_STALE_TIME = 60 * 1000;

let searchSources: readonly SearchSource[] = [];

export const configureSearchSources = (sources: readonly SearchSource[]) => {
  searchSources = sources;
};

export const getSearchSources = (): readonly SearchSource[] => searchSources;

export const searchSourceQueryOptions = ({
  locale,
  source,
  term,
}: {
  locale: string;
  source: SearchSource;
  term: string;
}) =>
  queryOptions({
    queryFn: async ({ signal }) =>
      await source.search({ locale, signal, term }),
    queryKey: ["vitnode-search-source", source.id, locale, term] as const,
    retry: false,
    staleTime: SEARCH_SOURCE_STALE_TIME,
  });
