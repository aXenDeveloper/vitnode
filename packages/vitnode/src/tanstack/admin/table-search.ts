import type {
  AdminTableContract,
  AdminTableOrder,
  AdminTableParams,
  RawAdminTableParams,
} from "@/views/admin/table/params";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { asSearchValue } from "@/lib/table-params";
import { normalizeAdminTableParams } from "@/views/admin/table/params";

const defaultPageSizeOf = (contract: { defaultPageSize?: number }): string =>
  String(contract.defaultPageSize ?? DEFAULT_TABLE_PAGE_SIZE);

export interface AdminTableRouteSearch<TOrderBy extends string = string> {
  cursor?: string;
  first?: number;
  last?: number;
  order?: AdminTableOrder;
  orderBy?: TOrderBy;
  page?: number;
  search?: string;
  status?: string;
}

export type UncheckedAdminTableSearch<TOrderBy extends string = string> =
  AdminTableRouteSearch<TOrderBy> | Record<string, unknown>;

const rawParamsOf = (
  input: UncheckedAdminTableSearch,
): RawAdminTableParams => ({
  cursor: asSearchValue(input.cursor),
  first: asSearchValue(input.first),
  last: asSearchValue(input.last),
  page: asSearchValue(input.page),
  order: asSearchValue(input.order),
  orderBy: asSearchValue(input.orderBy),
  search: asSearchValue(input.search),
  status: asSearchValue(input.status),
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
  const { cursor, first, last, order, orderBy, page, search, status } =
    adminTableRouteParams(input, contract);

  return {
    ...(cursor === undefined ? {} : { cursor }),
    ...(page === undefined ? {} : { page: Number(page) }),
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
