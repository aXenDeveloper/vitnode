import type { QueryKey } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import { CONTENT_PUBLIC_MAX_PAGE_SIZE } from "@/content/const";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";

/** The longest search term a public list keeps, like the site search. */
const MAX_TERM_LENGTH = 256;

/** One sort a public list offers: the list route's `orderBy` and `order`. */
export interface ContentListSort<TOrderBy extends string = string> {
  order: "asc" | "desc";
  orderBy: TOrderBy;
}

/**
 * One filter a public list keeps in its URL: turns a raw query-string value
 * into the filter's value - a string, number or boolean, so it can be written
 * back - or `undefined` when it is missing or invalid. A stale bookmark is
 * ignored, never an error.
 */
export type ContentListFilterParser<TValue> = (
  raw: unknown,
) => TValue | undefined;

/** What {@link defineContentList} is given. */
export interface ContentListConfig<
  TSorts extends Record<string, ContentListSort>,
  TFilters extends Record<string, ContentListFilterParser<unknown>>,
> {
  /** The sort a URL without `sort` uses. It is never written to the URL. */
  defaultSort: keyof TSorts & string;
  /** Extra URL filters, by URL name. Map them to the API's names at the call site. */
  filters?: TFilters;
  /**
   * Records per page, sent as `first`. Defaults to 12 and is capped at the
   * public API's own limit of 50.
   */
  pageSize?: number;
  /**
   * Every sort the list offers, by URL value - `{ newest: { orderBy:
   * "publishedAt", order: "desc" } }`. Each `orderBy` must be one of the
   * content type's `publicApi.orderableFields` (or `publishedAt`).
   */
  sorts: TSorts;
}

/**
 * A public list's state as its URL holds it, normalized: `page` only above 1,
 * `q` trimmed and non-empty, `sort` only when it is not the default, and each
 * filter only when set. Two URLs asking for the same list parse to the same
 * object, which is what keeps cache keys and canonical links stable.
 */
export type ContentListSearch<
  TSort extends string = string,
  TFilters extends Record<string, ContentListFilterParser<unknown>> = Record<
    never,
    never
  >,
> = {
  [K in keyof TFilters]?: NonNullable<ReturnType<TFilters[K]>>;
} & {
  page?: number;
  q?: string;
  sort?: TSort;
};

/**
 * The list route's paging, search and sort parameters for one
 * {@link ContentListSearch}: spread it into a `fetcher` call's `args.query`.
 */
export interface ContentListApiQuery<TOrderBy extends string = string> {
  first: string;
  order: "asc" | "desc";
  orderBy: TOrderBy;
  page: string;
  search?: string;
}

/** A filter parser for a positive integer id, e.g. `?category=3`. */
export const contentListIdFilter: ContentListFilterParser<number> = raw => {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^[1-9]\d{0,15}$/.test(raw)
        ? Number(raw)
        : Number.NaN;

  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
};

const parsePage = (raw: unknown): number | undefined => {
  const page = contentListIdFilter(raw);

  return page !== undefined && page > 1 ? page : undefined;
};

const parseTerm = (raw: unknown): string | undefined => {
  // The router parses `?q=2026` as a number, so a numeric term comes back as one.
  const text =
    typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
  const term = text.trim().slice(0, MAX_TERM_LENGTH).trim();

  return term === "" ? undefined : term;
};

/**
 * Declares a public content list once - its sorts, its URL filters and its
 * page size - and returns the pure helpers every list surface needs: the
 * route's `search` validator, the URL update that resets pagination, the API
 * query and the `href` of a page. Universal and framework-free apart from its
 * types, so the same object serves a route loader, a page and a component
 * embedded somewhere else.
 *
 * @example
 * ```ts
 * import { contentListIdFilter, defineContentList } from "@vitnode/core/tanstack/content";
 *
 * export const articleList = defineContentList({
 *   defaultSort: "newest",
 *   filters: { category: contentListIdFilter },
 *   pageSize: 12,
 *   sorts: {
 *     newest: { order: "desc", orderBy: "publishedAt" },
 *     oldest: { order: "asc", orderBy: "publishedAt" },
 *   },
 * });
 *
 * articleList.parseSearch({ page: "2", q: " vite ", sort: "newest" });
 * // { page: 2, q: "vite" }
 * articleList.apiQuery({ page: 2, q: "vite" });
 * // { first: "12", order: "desc", orderBy: "publishedAt", page: "2", search: "vite" }
 * ```
 */
export const defineContentList = <
  const TSorts extends Record<string, ContentListSort>,
  const TFilters extends Record<string, ContentListFilterParser<unknown>> =
    Record<never, never>,
>(
  config: ContentListConfig<TSorts, TFilters>,
) => {
  type TSort = keyof TSorts & string;
  type Search = ContentListSearch<TSort, TFilters>;

  const filters = (config.filters ?? {}) as TFilters;
  const filterNames = Object.keys(filters).sort() as (keyof TFilters &
    string)[];
  const pageSize = Math.min(
    Math.max(Math.trunc(config.pageSize ?? 12), 1),
    CONTENT_PUBLIC_MAX_PAGE_SIZE,
  );
  const sortNames = Object.keys(config.sorts) as TSort[];

  const isSort = (value: unknown): value is TSort =>
    typeof value === "string" && Object.hasOwn(config.sorts, value);

  const parseSearch = (input: Record<string, unknown>): Search => {
    const search: Record<string, unknown> = {};

    // A fixed key order, so the URL the router writes back is the same however
    // the parameters arrived.
    for (const name of filterNames) {
      const value = filters[name](input[name]);
      if (value !== undefined) search[name] = value;
    }

    const page = parsePage(input.page);
    if (page !== undefined) search.page = page;

    const q = parseTerm(input.q);
    if (q !== undefined) search.q = q;

    if (isSort(input.sort) && input.sort !== config.defaultSort) {
      search.sort = input.sort;
    }

    return search as Search;
  };

  return {
    /** The list route's paging, search and sort query for one state. */
    apiQuery: (
      search: Search,
    ): ContentListApiQuery<TSorts[TSort]["orderBy"]> => {
      const sort = config.sorts[search.sort ?? config.defaultSort];

      return {
        first: String(pageSize),
        order: sort.order,
        orderBy: sort.orderBy,
        // Always numbered, so `pageInfo` carries `currentPage` and `totalPages`.
        page: String(search.page ?? 1),
        ...(search.q === undefined ? {} : { search: search.q }),
      };
    },

    defaultSort: config.defaultSort,

    /**
     * The list's address for one state, e.g. `/blog?category=3&page=2`. Pass
     * an internal path; a locale-aware link component adds the locale prefix.
     */
    href: (pathname: string, search: Search): string => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(parseSearch(search))) {
        // A URL holds text; a filter that parses to anything richer cannot
        // round-trip through one.
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          params.set(key, String(value));
        }
      }
      const query = params.toString();

      return query === "" ? pathname : `${pathname}?${query}`;
    },

    /** Whether the state narrows the list: a term, a filter or another sort. */
    isFiltered: (search: Search): boolean =>
      Object.keys(parseSearch(search)).some(key => key !== "page"),

    pageSize,

    /** The route's `search` validator: any query string in, a normalized state out. */
    parseSearch,

    /** Every sort, in declaration order - for a sort control. */
    sorts: sortNames,

    /**
     * The state after a change. Changing anything but `page` goes back to the
     * first page, since page 4 of the old results says nothing about the new
     * ones. Pass `undefined` to clear a value.
     */
    withSearch: (current: Search, patch: Partial<Search>): Search => {
      const resetsPage = Object.keys(patch).some(
        key =>
          key !== "page" &&
          (patch as Record<string, unknown>)[key] !==
            (current as Record<string, unknown>)[key],
      );

      return parseSearch({
        ...current,
        ...patch,
        page: resetsPage ? undefined : (patch.page ?? current.page),
      });
    },
  };
};

/**
 * TanStack Query options for one page of a public list, usable as is in a
 * route `loader` (`queryClient.query(...)`) and in a component (`useQuery`).
 *
 * The key is `[...queryKey, { locale, ...search }]` with the normalized state,
 * so every locale, filter, term, sort and page is cached on its own and
 * `invalidateQueries({ queryKey })` refreshes them all. Fresh for
 * `RECORD_STALE_TIME` (one minute), like a published record. `fetch` makes the
 * request - write the `fetcher` call there, inline, so its route and response
 * stay inferred.
 *
 * @example
 * ```ts
 * import { contentListQueryOptions } from "@vitnode/core/tanstack/content";
 * import { fetcher } from "@vitnode/core/tanstack/fetcher";
 *
 * const articlesQueryOptions = (request: { locale: string; search: ArticleSearch }) =>
 *   contentListQueryOptions({
 *     ...request,
 *     queryKey: ["@acme/news", "articles"],
 *     fetch: async ({ locale, search }) => {
 *       const res = await fetcher({
 *         plugin: "@acme/news",
 *         method: "get",
 *         module: "content/articles",
 *         path: "/",
 *         args: { query: { ...articleList.apiQuery(search), locale } },
 *       });
 *       if (res.status !== 200) throw new Error("Loading the articles failed.");
 *
 *       return await res.json();
 *     },
 *   });
 * ```
 */
export const contentListQueryOptions = <
  TSearch extends object,
  TData,
  const TKey extends QueryKey,
>({
  fetch,
  locale,
  queryKey,
  search,
  staleTime = RECORD_STALE_TIME,
}: {
  fetch: (request: { locale: string; search: TSearch }) => Promise<TData>;
  locale: string;
  /** The prefix every page of this list shares, e.g. `["@vitnode/blog", "posts"]`. */
  queryKey: TKey;
  /** The normalized state - from the list's `parseSearch`, or a fixed one. */
  search: TSearch;
  staleTime?: number;
}) =>
  queryOptions({
    queryFn: async () => await fetch({ locale, search }),
    queryKey: [...queryKey, { locale, ...search }] as const,
    staleTime,
  });
