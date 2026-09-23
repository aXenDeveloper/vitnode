import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { readFirstValue, readPageSize } from "@/lib/table-params";

/** The largest page any VitNode endpoint serves - `MAX_PAGE_SIZE` in `api/lib/with-pagination`. */
export const ADMIN_TABLE_MAX_PAGE_SIZE = 100;

export const ADMIN_TABLE_ORDER = ["asc", "desc"] as const;
export type AdminTableOrder = (typeof ADMIN_TABLE_ORDER)[number];

export interface AdminTableParams<TOrderBy extends string = string> {
  cursor?: string;
  first?: string;
  last?: string;
  order?: AdminTableOrder;
  orderBy?: TOrderBy;
  page?: string;
  search?: string;
  /** Comma-separated, as the queue route's `status` filter reads it. */
  status?: string;
}

export type RawAdminTableParams = Partial<
  Record<keyof AdminTableParams, null | string | string[] | undefined>
>;

/** What a screen declares about its own table. */
export interface AdminTableContract<TOrderBy extends string = string> {
  defaultPageSize?: number;
  /** The columns this list may be sorted by - the route's `orderBy` enum. */
  orderBy: readonly TOrderBy[];
  /** Whether the table renders a search box the API reads. */
  search?: boolean;
  /** The values a status filter accepts, when the table has one. */
  status?: readonly string[];
}

const readStatus = (
  raw: string,
  allowed: readonly string[],
): string | undefined => {
  const values = [
    ...new Set(raw.split(",").filter(value => allowed.includes(value))),
  ].sort((a, b) => a.localeCompare(b));

  return values.length > 0 ? values.join(",") : undefined;
};

export const normalizeAdminTableParams = <TOrderBy extends string>(
  raw: RawAdminTableParams,
  contract: AdminTableContract<TOrderBy>,
): AdminTableParams<TOrderBy> => {
  const params: AdminTableParams<TOrderBy> = {};

  const page = readFirstValue(raw.page);
  if (/^[1-9]\d{0,8}$/.test(page) && page !== "1") params.page = page;

  // A page number and a cursor answer different questions, and the API refuses
  // both together, so the number wins and the walk is dropped.
  const cursor = params.page ? "" : readFirstValue(raw.cursor);
  if (/^[A-Za-z0-9_-]{1,512}$/.test(cursor)) params.cursor = cursor;

  const first = readPageSize(
    readFirstValue(raw.first),
    ADMIN_TABLE_MAX_PAGE_SIZE,
  );
  const last = readPageSize(
    readFirstValue(raw.last),
    ADMIN_TABLE_MAX_PAGE_SIZE,
  );

  if (first !== undefined) {
    params.first = first;
  } else if (params.page !== undefined) {
    params.first = String(contract.defaultPageSize ?? DEFAULT_TABLE_PAGE_SIZE);
  } else if (last === undefined) {
    params.first = String(contract.defaultPageSize ?? DEFAULT_TABLE_PAGE_SIZE);
  } else {
    params.last = last;
  }

  const orderBy = readFirstValue(raw.orderBy) as TOrderBy;
  if (contract.orderBy.includes(orderBy)) params.orderBy = orderBy;

  const order = readFirstValue(raw.order) as AdminTableOrder;
  if (ADMIN_TABLE_ORDER.includes(order)) params.order = order;

  if (contract.search) {
    const search = readFirstValue(raw.search).trim();
    if (search) params.search = search;
  }

  if (contract.status) {
    const status = readStatus(readFirstValue(raw.status), contract.status);
    if (status) params.status = status;
  }

  return params;
};

export interface AdminTablePageInfo {
  count: number;
  currentPage: null | number;
  endCursor: null | string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageSize: number;
  startCursor: null | string;
  totalCount: number;
  totalPages: number;
}

/** One page of an admin list: the rows, and where the pager is. */
export interface AdminTablePage<TRow> {
  edges: TRow[];
  pageInfo: AdminTablePageInfo;
}
