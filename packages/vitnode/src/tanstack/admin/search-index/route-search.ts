/**
 * The search index screen's URL contract: one parameter, and nothing else.
 *
 * The collections table has a search box and no pager - the whole list arrives
 * in one status read - so `?search=` is the only thing any control here writes.
 * It is deliberately *not* built on `../table-search`: that module always names a
 * page size, which this screen has no use for and which would appear in the URL
 * of a table that cannot page.
 *
 * Total and idempotent, like every route search schema: a hand-edited
 * `?search=` renders the unfiltered list rather than a router error, and running
 * the rule on its own output changes nothing.
 */

/** The route's validated search. */
export interface SearchIndexRouteSearch {
  search?: string;
}

/** A search as it arrives, before anything has checked it. */
export type UncheckedSearchIndexSearch =
  Record<string, unknown> | SearchIndexRouteSearch;

/**
 * The route's `validateSearch`.
 *
 * The router hands over its *parsed* search, whose default parser JSON-parses
 * every value - so a numeric-looking term arrives as a number and a repeated key
 * as an array. Only a string is kept, trimmed, and an empty one is dropped:
 * `?search=` and no `search` are the same unfiltered list, and keeping the empty
 * parameter would write it into every link the router builds to this route.
 */
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

/**
 * A query string that box produced, back as route search.
 *
 * The return leg. `withTableSearch` also clears the cursor triplet on its way
 * through, which this screen has none of - so everything but `search` is dropped
 * here, which is the same answer arrived at from the other side.
 */
export const searchIndexSearchFrom = (
  nextSearch: string,
): SearchIndexRouteSearch =>
  normalizeSearchIndexRouteSearch(
    Object.fromEntries(new URLSearchParams(nextSearch)),
  );
