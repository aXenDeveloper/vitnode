import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";

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

/** The first value for a key, since only one can reach the API. */
const readOne = (value: null | string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? "";

  return value ?? "";
};

const readPageSize = (raw: string): string | undefined => {
  if (!/^\d+$/.test(raw)) return undefined;

  const size = Number(raw);
  if (!Number.isSafeInteger(size) || size < 1) return undefined;

  return String(Math.min(size, ADMIN_TABLE_MAX_PAGE_SIZE));
};

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

  const cursor = readOne(raw.cursor);
  if (/^[A-Za-z0-9_-]{1,512}$/.test(cursor)) params.cursor = cursor;

  const first = readPageSize(readOne(raw.first));
  const last = readPageSize(readOne(raw.last));

  if (first !== undefined) {
    params.first = first;
  } else if (last === undefined) {
    params.first = String(contract.defaultPageSize ?? DEFAULT_TABLE_PAGE_SIZE);
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
