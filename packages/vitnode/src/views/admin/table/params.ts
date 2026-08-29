import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";

/**
 * What an AdminCP list route reads out of its URL, for every table that is a
 * `DataTable` over a paginated admin endpoint.
 *
 * One normaliser rather than one per screen, because the four admin tables -
 * cron, the queue, uploaded files and the system log - differ in exactly three
 * declarations: which columns they sort by, whether they have a search box, and
 * whether they have a status filter. Everything else about them is identical,
 * and the parts that are identical are precisely the parts that are easy to get
 * subtly wrong per screen.
 *
 * Pure: no transport, no React, no framework. Both applications call it - the
 * Next.js Server Component on its `searchParams`, the TanStack Start route on
 * its validated search - so `?orderBy=name&first=20` is the same request in
 * both rather than two hand-written approximations of it.
 *
 * ## Why the defaults are applied here rather than in the fetcher
 *
 * The Next.js pages reach the API through `fetcher(..., { withPagination: true })`,
 * which quietly writes `first=10` and `search=""` inside the URL builder. That
 * is invisible to anything upstream - including a query key - so two requests
 * that differ only in that hidden default share one cache entry. `/files` paid
 * for that lesson first (see `views/files/my-files-query.ts`); this module is
 * the same fix applied to the AdminCP's tables, which is why nothing built on it
 * passes `withPagination`.
 *
 * ## Every rule below exists because the alternative is a broken page
 *
 * - **A page size is always present**, so the request the key describes is the
 *   request that is sent.
 * - **`first` wins over `last`.** They are mutually exclusive and the API 400s
 *   on both; a URL carrying both was written by hand, and forward is the
 *   direction it meant.
 * - **An unusable page size falls back** rather than 400ing: `?first=abc`,
 *   `?first=0` and `?first=-1` should render the table the administrator would
 *   have got had they not edited the address bar.
 * - **A sort column the screen cannot sort by is dropped**, so the API applies
 *   its own default ordering instead of refusing the request.
 * - **A blank search is no search.** The API trims and treats empty as no
 *   filter, so `?search=` and no `search` must not be two cache entries holding
 *   identical rows.
 * - **A cursor is shape-checked only.** It is opaque and belongs to the ordering
 *   that minted it; a value that cannot be one is dropped rather than sent.
 */

/** The largest page any VitNode endpoint serves - `MAX_PAGE_SIZE` in `api/lib/with-pagination`. */
export const ADMIN_TABLE_MAX_PAGE_SIZE = 100;

export const ADMIN_TABLE_ORDER = ["asc", "desc"] as const;
export type AdminTableOrder = (typeof ADMIN_TABLE_ORDER)[number];

/**
 * A normalised admin list request - and therefore the shape a cache key is
 * built from.
 *
 * Generic over the sortable columns so a screen's `orderBy` is its own union
 * rather than `string`: a column that is not in the route's zod enum is a `400`,
 * and the type is what stops one being written in the first place.
 */
export interface AdminTableParams<TOrderBy extends string = string> {
  cursor?: string;
  first?: string;
  last?: string;
  order?: AdminTableOrder;
  orderBy?: TOrderBy;
  search?: string;
  /** Comma-separated, as the queue route's `status` filter reads it. */
  status?: string;
}

/**
 * The URL as either framework hands it over, before anything has checked it.
 *
 * Widened to `string[]` because a query string may repeat a key and both routers
 * surface that as an array, and to `null` because `URLSearchParams.get` returns
 * one. None of it is trusted.
 */
export type RawAdminTableParams = Partial<
  Record<keyof AdminTableParams, null | string | string[] | undefined>
>;

/** What a screen declares about its own table. */
export interface AdminTableContract<TOrderBy extends string = string> {
  /** The columns this list may be sorted by - the route's `orderBy` enum. */
  orderBy: readonly TOrderBy[];
  /** Whether the table renders a search box the API reads. */
  search?: boolean;
  /** The values a status filter accepts, when the table has one. */
  status?: readonly string[];
}

/** The first value for a key, since only one can reach the API. */
const readOne = (value: null | string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? "";

  return value ?? "";
};

/**
 * A page size, or `undefined` when the URL did not ask for a usable one.
 *
 * Clamped as well as validated: past {@link ADMIN_TABLE_MAX_PAGE_SIZE} the API
 * answers `400`, and a table that 400s because somebody typed `?first=5000` is a
 * broken page rather than a refused one.
 */
const readPageSize = (raw: string): string | undefined => {
  if (!/^\d+$/.test(raw)) return undefined;

  const size = Number(raw);
  if (!Number.isSafeInteger(size) || size < 1) return undefined;

  return String(Math.min(size, ADMIN_TABLE_MAX_PAGE_SIZE));
};

/**
 * The `status` filter, reduced to the values the screen declared.
 *
 * The filter writes a comma-separated list (`?status=failed,pending`) and the
 * queue route splits it and drops anything it does not recognise. Doing the same
 * here is what keeps the cache key honest: `?status=nonsense` and no `status` at
 * all are the same query, so they must be the same entry. Order and duplicates
 * are normalised for the same reason.
 */
const readStatus = (
  raw: string,
  allowed: readonly string[],
): string | undefined => {
  const values = [
    ...new Set(raw.split(",").filter(value => allowed.includes(value))),
  ].sort((a, b) => a.localeCompare(b));

  return values.length > 0 ? values.join(",") : undefined;
};

/**
 * The request this URL is asking for.
 *
 * Total and idempotent: it cannot throw and running it on its own output changes
 * nothing. Both properties are requirements of where it runs - a `validateSearch`
 * that throws turns a hand-edited query string into a router error screen, and
 * the normaliser is applied twice on every table navigation (once to turn a
 * control's new query string back into route search, once more when the router
 * validates the location that produces).
 */
export const normalizeAdminTableParams = <TOrderBy extends string>(
  raw: RawAdminTableParams,
  contract: AdminTableContract<TOrderBy>,
): AdminTableParams<TOrderBy> => {
  const params: AdminTableParams<TOrderBy> = {};

  const cursor = readOne(raw.cursor);
  if (/^[A-Za-z0-9_-]{1,512}$/.test(cursor)) params.cursor = cursor;

  const first = readPageSize(readOne(raw.first));
  const last = readPageSize(readOne(raw.last));

  if (first !== undefined) {
    params.first = first;
  } else if (last === undefined) {
    params.first = String(DEFAULT_TABLE_PAGE_SIZE);
  } else {
    params.last = last;
  }

  const orderBy = readOne(raw.orderBy) as TOrderBy;
  if (contract.orderBy.includes(orderBy)) params.orderBy = orderBy;

  const order = readOne(raw.order) as AdminTableOrder;
  if (ADMIN_TABLE_ORDER.includes(order)) params.order = order;

  if (contract.search) {
    const search = readOne(raw.search).trim();
    if (search) params.search = search;
  }

  if (contract.status) {
    const status = readStatus(readOne(raw.status), contract.status);
    if (status) params.status = status;
  }

  return params;
};

/**
 * The pager's own state, as every paginated VitNode endpoint returns it.
 *
 * `zodPaginationPageInfo` in `api/lib/with-pagination` is the schema; this is
 * the frontend's name for it, declared once so four screens do not each spell
 * out six fields. Assigning a fetcher's inferred response to a page built on it
 * is what keeps the two in step: rename a field in the schema and the
 * assignment stops compiling.
 *
 * The cursors are opaque. They encode the ordered tuple the next page continues
 * from, so they are meaningless outside the ordering that produced them - hand
 * them back unchanged.
 */
export interface AdminTablePageInfo {
  count: number;
  endCursor: null | string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: null | string;
  totalCount: number;
}

/** One page of an admin list: the rows, and where the pager is. */
export interface AdminTablePage<TRow> {
  edges: TRow[];
  pageInfo: AdminTablePageInfo;
}
