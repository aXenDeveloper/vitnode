/**
 * Every URL a `DataTable` control can ask for, as plain functions.
 *
 * A sort header, a page button, the search box and a filter dropdown all do the
 * same thing: take the query string the page is on, change one thing about it,
 * and hand the result to whatever knows how to navigate. Only that last step
 * differs between Next.js and TanStack Start - the rest is string arithmetic,
 * so it lives here, framework-free and testable without a router.
 *
 * Two rules hold everywhere below, because the table's URLs are also its API
 * arguments and a control that forgot one would silently drop the visitor's
 * work:
 *
 * - **Unrelated parameters survive.** Every helper copies the search it was
 *   given and edits the copy, so a plugin's own `?tab=` outlives a sort click.
 * - **A parameter is removed rather than emptied.** `?search=` and `?cursor=`
 *   with no value are not the same request as their absence, and the API reads
 *   the presence of a cursor to decide which page it is on.
 *
 * Which parameters *reset* is deliberately uneven, and matches what the table
 * has always done: paging and filtering rewrite the cursor, sorting and
 * searching leave it alone.
 */

/** The parameter a page size is written to when paging forwards. */
const FIRST = "first";
/** The parameter a page size is written to when paging backwards. */
const LAST = "last";
/** The row the next page starts from. Meaningless without `first` or `last`. */
const CURSOR = "cursor";

/**
 * The page size a table shows when the URL does not ask for one.
 *
 * Also the fallback for a `first`/`last` that is not a positive number: the
 * value goes straight back into the URL when the visitor pages, and `?first=NaN`
 * is not a request the API can answer.
 */
export const DEFAULT_TABLE_PAGE_SIZE = 10;

/**
 * How much has to be typed before a search reaches the URL.
 *
 * Below it the parameter is removed instead, so backspacing to nothing restores
 * the unfiltered table rather than searching for an empty string.
 */
export const MIN_TABLE_SEARCH_LENGTH = 3;

export type TableOrderDirection = "asc" | "desc";

/** Whatever the caller has: a raw query string, or the params it parsed. */
export type TableSearch = string | URLSearchParams;

export interface TableOrder {
  column: string;
  order: TableOrderDirection;
}

/**
 * A copy of the given search, safe to edit.
 *
 * Copying is the point: callers hand in the params object the router owns -
 * Next's is frozen and throws on `set` - and every helper here returns a new
 * string rather than mutating what it was passed.
 */
const copy = (search: TableSearch): URLSearchParams =>
  new URLSearchParams(search.toString());

/** Removes the whole cursor triplet, so the result is "page one" again. */
const resetPagination = (params: URLSearchParams): void => {
  params.delete(CURSOR);
  params.delete(FIRST);
  params.delete(LAST);
};

/** The column and direction the table is sorted by right now. */
export const readTableOrder = (
  search: TableSearch,
  defaultOrder: TableOrder,
): TableOrder => {
  const params = copy(search);

  return {
    column: params.get("orderBy") ?? defaultOrder.column,
    order:
      (params.get("order") as null | TableOrderDirection) ?? defaultOrder.order,
  };
};

/** Sorts by `column` in `order`, leaving the current page alone. */
export const withTableOrder = (
  search: TableSearch,
  { column, order }: TableOrder,
): string => {
  const params = copy(search);
  params.set("orderBy", column);
  params.set("order", order);

  return params.toString();
};

/**
 * What clicking a sort header does.
 *
 * A column that is already sorted ascending flips to descending; anything else
 * - a different column, or the same one descending - starts again at ascending,
 * which is what makes a third click on the same header undo the second.
 */
export const toggleTableOrder = (
  search: TableSearch,
  { column, defaultOrder }: { column: string; defaultOrder: TableOrder },
): string => {
  const current = readTableOrder(search, defaultOrder);
  const isActive = current.column === column;

  return withTableOrder(search, {
    column,
    order: isActive && current.order === "asc" ? "desc" : "asc",
  });
};

/** How many rows the URL is asking for, whichever direction it is paging. */
export const readTablePageSize = (search: TableSearch): number => {
  const params = copy(search);
  const size = Number(params.get(FIRST) ?? params.get(LAST));

  return Number.isInteger(size) && size > 0 ? size : DEFAULT_TABLE_PAGE_SIZE;
};

/**
 * Shows `pageSize` rows, from the beginning.
 *
 * The cursor goes with the old page size: a cursor is a position in a result
 * set the visitor is no longer looking at, and keeping it would land them
 * somewhere they never asked to be.
 */
export const withTablePageSize = (
  search: TableSearch,
  pageSize: number | string,
): string => {
  const params = copy(search);
  params.set(FIRST, `${pageSize}`);
  params.delete(LAST);
  params.delete(CURSOR);

  return params.toString();
};

/**
 * Steps one page forwards or backwards from `cursor`.
 *
 * Direction is the parameter name: `first` reads forwards from the cursor,
 * `last` reads backwards from it, and the two are mutually exclusive, so the
 * one not being used is removed rather than left behind to contradict it.
 *
 * A missing cursor - the API returns none for an empty page - removes the
 * parameter instead of writing `?cursor=`, which lands on the first page.
 */
export const withTablePage = (
  search: TableSearch,
  {
    cursor,
    direction,
    pageSize,
  }: {
    cursor: null | string;
    direction: "next" | "previous";
    pageSize: number | string;
  },
): string => {
  const params = copy(search);
  const [take, drop] = direction === "next" ? [FIRST, LAST] : [LAST, FIRST];

  params.set(take, `${Number(pageSize)}`);

  if (cursor) {
    params.set(CURSOR, cursor);
  } else {
    params.delete(CURSOR);
  }

  params.delete(drop);

  return params.toString();
};

/** What the search box should show for the URL it is on. */
export const readTableSearch = (search: TableSearch): string =>
  copy(search).get("search") ?? "";

/**
 * Searches for `value`, or stops searching when it is too short.
 *
 * The page is deliberately *not* reset. It never has been, and the table reads
 * a cursor the API hands back rather than a page number, so a stale one is
 * corrected by the next response instead of being guessed at here.
 */
export const withTableSearch = (search: TableSearch, value: string): string => {
  const params = copy(search);

  if (value.length >= MIN_TABLE_SEARCH_LENGTH) {
    params.set("search", value);
  } else {
    params.delete("search");
  }

  return params.toString();
};

/** The values a faceted filter currently has selected. */
export const readTableFilter = (search: TableSearch, id: string): string[] =>
  (copy(search).get(id)?.split(",") ?? []).filter(Boolean);

/**
 * Selects `values` for one filter, and returns to the first page.
 *
 * Unlike sorting, a filter changes *which* rows exist, so the cursor the
 * visitor was holding points into a result set that no longer exists.
 */
export const withTableFilter = (
  search: TableSearch,
  { id, values }: { id: string; values: string[] },
): string => {
  const params = copy(search);

  if (values.length) {
    params.set(id, values.join(","));
  } else {
    params.delete(id);
  }

  resetPagination(params);

  return params.toString();
};
