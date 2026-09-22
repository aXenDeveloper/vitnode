import type {
  MyFilesOrder,
  MyFilesOrderBy,
  MyFilesParams,
  RawMyFilesParams,
} from "@/views/files/my-files-query";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { asSearchValue } from "@/lib/table-params";
import { normalizeMyFilesParams } from "@/views/files/my-files-query";

const DEFAULT_PAGE_SIZE = String(DEFAULT_TABLE_PAGE_SIZE);

export interface MyFilesRouteSearch {
  cursor?: string;
  first?: number;
  last?: number;
  order?: MyFilesOrder;
  orderBy?: MyFilesOrderBy;
  page?: number;
  search?: string;
}

export type UncheckedMyFilesSearch =
  MyFilesRouteSearch | Record<string, unknown>;

const rawParamsOf = (input: UncheckedMyFilesSearch): RawMyFilesParams => ({
  cursor: asSearchValue(input.cursor),
  first: asSearchValue(input.first),
  last: asSearchValue(input.last),
  order: asSearchValue(input.order),
  page: asSearchValue(input.page),
  orderBy: asSearchValue(input.orderBy),
  search: asSearchValue(input.search),
});

export const myFilesRouteParams = (
  input: UncheckedMyFilesSearch,
): MyFilesParams => normalizeMyFilesParams(rawParamsOf(input));

export const normalizeMyFilesRouteSearch = (
  input: UncheckedMyFilesSearch,
): MyFilesRouteSearch => {
  const { cursor, first, last, order, orderBy, page, search } =
    myFilesRouteParams(input);

  return {
    ...(cursor === undefined ? {} : { cursor }),
    ...(page === undefined ? {} : { page: Number(page) }),
    // See above: the default page size is the URL saying nothing.
    ...(first === undefined || first === DEFAULT_PAGE_SIZE
      ? {}
      : { first: Number(first) }),
    // `last` is never dropped: paging *backwards* at the default size is a
    // different request from not paging at all, and the parameter is what says
    // so.
    ...(last === undefined ? {} : { last: Number(last) }),
    ...(order === undefined ? {} : { order }),
    ...(orderBy === undefined ? {} : { orderBy }),
    ...(search === undefined ? {} : { search }),
  };
};

export const myFilesSearchParams = (
  input: UncheckedMyFilesSearch,
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(
    normalizeMyFilesRouteSearch(input),
  )) {
    params.set(key, String(value));
  }

  return params;
};

export const myFilesSearchFrom = (nextSearch: string): MyFilesRouteSearch =>
  normalizeMyFilesRouteSearch(
    Object.fromEntries(new URLSearchParams(nextSearch)),
  );
