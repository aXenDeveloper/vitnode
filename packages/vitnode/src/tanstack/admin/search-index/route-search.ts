/** The route's validated search. */
export interface SearchIndexRouteSearch {
  search?: string;
}

/** A search as it arrives, before anything has checked it. */
export type UncheckedSearchIndexSearch =
  Record<string, unknown> | SearchIndexRouteSearch;

export const normalizeSearchIndexRouteSearch = (
  input: UncheckedSearchIndexSearch,
): SearchIndexRouteSearch => {
  const value = input.search;
  const search = typeof value === "string" ? value.trim() : "";

  return search ? { search } : {};
};

/** The query string the table's search box reads itself out of. */
export const searchIndexSearchParams = (
  input: UncheckedSearchIndexSearch,
): URLSearchParams => {
  const params = new URLSearchParams();
  const { search } = normalizeSearchIndexRouteSearch(input);

  if (search !== undefined) params.set("search", search);

  return params;
};

export const searchIndexSearchFrom = (
  nextSearch: string,
): SearchIndexRouteSearch =>
  normalizeSearchIndexRouteSearch(
    Object.fromEntries(new URLSearchParams(nextSearch)),
  );
