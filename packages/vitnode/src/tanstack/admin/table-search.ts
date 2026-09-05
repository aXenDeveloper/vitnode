import type {
  AdminTableContract,
  AdminTableOrder,
  AdminTableParams,
  RawAdminTableParams,
} from "@/views/admin/table/params";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { normalizeAdminTableParams } from "@/views/admin/table/params";

const defaultPageSizeOf = (contract: { defaultPageSize?: number }): string =>
  String(contract.defaultPageSize ?? DEFAULT_TABLE_PAGE_SIZE);

export interface AdminTableRouteSearch<TOrderBy extends string = string> {
  cursor?: string;
  first?: number;
  last?: number;
  order?: AdminTableOrder;
  orderBy?: TOrderBy;
  search?: string;
  status?: string;
}

export type UncheckedAdminTableSearch<TOrderBy extends string = string> =
  AdminTableRouteSearch<TOrderBy> | Record<string, unknown>;

const readParam = (value: unknown): string | undefined => {
  const one = Array.isArray(value) ? (value[0] as unknown) : value;

  if (typeof one === "string") return one;
  if (typeof one === "number")
    return Number.isFinite(one) ? String(one) : undefined;
  if (typeof one === "boolean") return String(one);

  return undefined;
};

const rawParamsOf = (
  input: UncheckedAdminTableSearch,
): RawAdminTableParams => ({
  cursor: readParam(input.cursor),
  first: readParam(input.first),
  last: readParam(input.last),
  order: readParam(input.order),
  orderBy: readParam(input.orderBy),
  search: readParam(input.search),
  status: readParam(input.status),
});

export const adminTableRouteParams = <TOrderBy extends string>(
  input: UncheckedAdminTableSearch<TOrderBy>,
  contract: AdminTableContract<TOrderBy>,
): AdminTableParams<TOrderBy> =>
  normalizeAdminTableParams(rawParamsOf(input), contract);

export const normalizeAdminTableSearch = <TOrderBy extends string>(
  input: UncheckedAdminTableSearch<TOrderBy>,
  contract: AdminTableContract<TOrderBy>,
): AdminTableRouteSearch<TOrderBy> => {
  const { cursor, first, last, order, orderBy, search, status } =
    adminTableRouteParams(input, contract);

  return {
    ...(cursor === undefined ? {} : { cursor }),
    // See above: the default page size is the URL saying nothing.
    ...(first === undefined || first === defaultPageSizeOf(contract)
      ? {}
      : { first: Number(first) }),
    // `last` is never dropped: paging *backwards* at the default size is a
    // different request from not paging at all, and the parameter is what says
    // so.
    ...(last === undefined ? {} : { last: Number(last) }),
    ...(order === undefined ? {} : { order }),
    ...(orderBy === undefined ? {} : { orderBy }),
    ...(search === undefined ? {} : { search }),
    ...(status === undefined ? {} : { status }),
  };
};

export const adminTableSearchParams = <TOrderBy extends string>(
  input: UncheckedAdminTableSearch<TOrderBy>,
  contract: AdminTableContract<TOrderBy>,
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(
    normalizeAdminTableSearch(input, contract),
  )) {
    params.set(key, String(value));
  }

  return params;
};

export const adminTableSearchFrom = <TOrderBy extends string>(
  nextSearch: string,
  contract: AdminTableContract<TOrderBy>,
): AdminTableRouteSearch<TOrderBy> =>
  normalizeAdminTableSearch(
    Object.fromEntries(new URLSearchParams(nextSearch)),
    contract,
  );

export type { AdminTableContract, AdminTableOrder, AdminTableParams };

export type AdminTableNavigate<TSearch> = (options: {
  resetScroll: boolean;
  search: TSearch;
}) => Promise<void>;
