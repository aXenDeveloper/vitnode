import { notFound } from "@tanstack/react-router";

import type {
  ResolvedContentDeliveryListConfig,
  ResolvedContentDeliveryListFilter,
} from "@/content/types";
import type { PluginRouteHead } from "@/routing";

import { getIntlRuntime } from "../i18n/runtime";

/** The longest `?q=` a list page passes on to the API. */
export const CONTENT_LIST_SEARCH_MAX_LENGTH = 256;

const TEXT_FILTER_MAX_LENGTH = 255;

/** The part of a content type a list page reads. A whole definition fits. */
export interface ContentListDefinition {
  delivery: { list: ResolvedContentDeliveryListConfig };
}

export type ContentListFilterValue = boolean | number | string;

/**
 * A list page's URL, after {@link contentListSearch} has read it.
 *
 * `page` is left out on the first page and `q` when nothing is searched, so the
 * plain `/blog` is the one address of the first page. Every other key is a
 * filter from `delivery.list.filters`.
 */
export interface ContentListSearch {
  [filter: string]: ContentListFilterValue | undefined;
  page?: number;
  q?: string;
}

/** The query string a list page sends to the public list route. */
export interface ContentListQuery {
  [filter: string]: string | undefined;
  first: string;
  page?: string;
  search?: string;
}

/** The part of the public list response a list page checks. */
export interface ContentListResponse {
  pageInfo: { currentPage: null | number; totalPages: number };
}

const asInteger = (value: unknown): number | undefined => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;

  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const asText = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;

  const text = String(value).trim().slice(0, maxLength).trim();

  return text.length > 0 ? text : undefined;
};

const readFilter = (
  filter: ResolvedContentDeliveryListFilter,
  value: unknown,
): ContentListFilterValue | undefined => {
  switch (filter.kind) {
    case "boolean":
      if (value === true || value === "true") return true;
      if (value === false || value === "false") return false;

      return undefined;
    case "enum":
      return typeof value === "string" && filter.values?.includes(value)
        ? value
        : undefined;
    case "number": {
      const parsed = typeof value === "string" ? Number(value) : value;

      return typeof parsed === "number" &&
        Number.isFinite(parsed) &&
        String(value).trim() !== ""
        ? parsed
        : undefined;
    }
    case "reference": {
      const id = asInteger(value);

      return id !== undefined && id > 0 ? id : undefined;
    }
    case "text":
      return asText(value, TEXT_FILTER_MAX_LENGTH);
  }
};

/**
 * Builds a list page's `search` validator from its content type.
 *
 * Reads `page`, `q` and the declared filters, and drops anything it cannot use
 * instead of failing: a stale bookmark or a tracking parameter still opens the
 * page.
 */
export const contentListSearch =
  ({ delivery: { list } }: ContentListDefinition) =>
  (input: Record<string, unknown>): ContentListSearch => {
    const search: ContentListSearch = {};

    const page = asInteger(input.page);
    if (page !== undefined && page > 1) search.page = page;

    if (list.searchable) {
      const q = asText(input.q, CONTENT_LIST_SEARCH_MAX_LENGTH);
      if (q !== undefined) search.q = q;
    }

    for (const filter of list.filters) {
      const value = readFilter(filter, input[filter.name]);
      if (value !== undefined) search[filter.name] = value;
    }

    return search;
  };

/**
 * Turns a list page's search into the query of the public list route.
 *
 * Spread it into `args.query` of the `fetcher` call that reads the list.
 */
export const contentListQuery = (
  { delivery: { list } }: ContentListDefinition,
  search: ContentListSearch,
): ContentListQuery => {
  const query: ContentListQuery = { first: String(list.pageSize) };

  if (search.page !== undefined && search.page > 1) {
    query.page = String(search.page);
  }
  if (list.searchable && search.q !== undefined) query.search = search.q;

  for (const filter of list.filters) {
    const value = search[filter.name];
    if (value !== undefined) query[filter.name] = String(value);
  }

  return query;
};

/**
 * Checks a list the page loaded against the page it asked for.
 *
 * The API answers a page past the end with the last page, which would put the
 * same records under every higher `?page=`. This turns that into a `404`.
 */
export const contentListPage = <TList extends ContentListResponse>({
  list,
  search,
}: {
  list: TList;
  search: ContentListSearch;
}): TList => {
  const requested = search.page ?? 1;

  if (requested > 1 && list.pageInfo.currentPage !== requested) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }

  return list;
};

/** Whether the search is the plain first page, with no `q` and no filter. */
export const isContentListIndexable = (search: ContentListSearch): boolean =>
  Object.values(search).every(value => value === undefined);

/**
 * The `<head>` of a list page.
 *
 * Only the plain first page is indexed, with a canonical link and one alternate
 * per language. Later pages and every search or filter result answer
 * `noindex, follow`: a crawler skips the page but still follows its links to
 * the records.
 */
export const contentListPageHead = (
  { delivery: { list } }: ContentListDefinition,
  {
    description,
    locales,
    search,
    title,
  }: {
    description?: string;
    /** The languages the page is served in. Defaults to every app locale. */
    locales?: readonly string[];
    search: ContentListSearch | undefined;
    title?: string;
  },
): PluginRouteHead => {
  const head: PluginRouteHead = {};

  if (title !== undefined) head.title = title;
  if (description !== undefined) head.description = description;

  if (search !== undefined && !isContentListIndexable(search)) {
    head.robots = "noindex, follow";

    return head;
  }

  if (list.path === "") return head;

  head.alternates = Object.fromEntries(
    (locales ?? getIntlRuntime().localeRouting.locales).map(locale => [
      locale,
      list.path,
    ]),
  );

  return head;
};

/**
 * The search of a link that changes the list: a filter, the term or the page.
 *
 * `undefined` removes a key. Any change other than `page` goes back to the
 * first page, because page 3 of one result set is not page 3 of another.
 */
export const nextContentListSearch = (
  search: ContentListSearch,
  changes: ContentListSearch,
): ContentListSearch => {
  const next: ContentListSearch = { ...search, ...changes };
  if (!("page" in changes)) delete next.page;
  if (next.page !== undefined && next.page <= 1) delete next.page;

  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) delete next[key];
  }

  return next;
};
