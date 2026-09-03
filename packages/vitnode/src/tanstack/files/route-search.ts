import type {
  MyFilesOrder,
  MyFilesOrderBy,
  MyFilesParams,
  RawMyFilesParams,
} from "@/views/files/my-files-query";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import { normalizeMyFilesParams } from "@/views/files/my-files-query";

const DEFAULT_PAGE_SIZE = String(DEFAULT_TABLE_PAGE_SIZE);

export interface MyFilesRouteSearch {
  cursor?: string;
  first?: number;
  last?: number;
  order?: MyFilesOrder;
  orderBy?: MyFilesOrderBy;
  search?: string;
}

export type UncheckedMyFilesSearch =
  MyFilesRouteSearch | Record<string, unknown>;

const readParam = (value: unknown): string | undefined => {
  const one = Array.isArray(value) ? (value[0] as unknown) : value;

  if (typeof one === "string") return one;
  if (typeof one === "number")
    return Number.isFinite(one) ? String(one) : undefined;
  if (typeof one === "boolean") return String(one);

  return undefined;
};

const rawParamsOf = (input: UncheckedMyFilesSearch): RawMyFilesParams => ({
  cursor: readParam(input.cursor),
  first: readParam(input.first),
  last: readParam(input.last),
  order: readParam(input.order),
  orderBy: readParam(input.orderBy),
  search: readParam(input.search),
});

export const myFilesRouteParams = (
  input: UncheckedMyFilesSearch,
): MyFilesParams => normalizeMyFilesParams(rawParamsOf(input));

export const normalizeMyFilesRouteSearch = (
  input: UncheckedMyFilesSearch,
): MyFilesRouteSearch => {
  const { cursor, first, last, order, orderBy, search } =
    myFilesRouteParams(input);

  return {
    ...(cursor === undefined ? {} : { cursor }),
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
