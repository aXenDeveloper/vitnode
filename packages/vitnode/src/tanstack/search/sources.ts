import type { LucideIcon } from "lucide-react";

import { queryOptions } from "@tanstack/react-query";

/** One result a {@link SearchSource} returns. */
export interface SearchSourceItem {
  /** A CSS color for the icon tile, e.g. `var(--docs-color)`. */
  color?: string;
  /** Where the result lives (a section or breadcrumb trail), shown under the title. */
  context?: null | string;
  /** Plain text; the part around the search term is shown and highlighted. */
  excerpt?: null | string;
  /** A Lucide icon name; the source's icon when unset. */
  icon?: string;
  /** Unique within the source. */
  id: string;
  title: string;
  /** An internal path such as `/docs/start`; results with any other URL are dropped. */
  url: string;
}

export interface SearchSourceQuery {
  locale: string;
  /** Aborted when the term changes; pass it to `fetch`. */
  signal: AbortSignal;
  /** The trimmed search term. */
  term: string;
}

/**
 * An extra result group in the header search dialog, next to the indexed
 * content - documentation, an external catalog. Registered with
 * {@link configureSearchSources}.
 */
export interface SearchSource {
  /** The fallback icon for results without their own. */
  icon: LucideIcon;
  /** Unique across sources; part of the query key. */
  id: string;
  /** The translation key of the group heading, from `namespace`. */
  labelKey: string;
  /** The message namespace the dialog loads for `labelKey`. */
  namespace: string;
  /**
   * Returns results for a term. Runs in the browser while the dialog suggests
   * (cached for a minute per locale and term, never retried); a rejection
   * leaves the group empty.
   */
  search: (query: SearchSourceQuery) => Promise<SearchSourceItem[]>;
}

const SEARCH_SOURCE_STALE_TIME = 60 * 1000;

let searchSources: readonly SearchSource[] = [];

/**
 * Registers the app's extra header-search sources, replacing any registered
 * before. Call it once at module scope in a module the router entry imports.
 */
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
