import type { AnyContentTypeDefinition } from "@/content/types";
import type {
  AdminTableContract,
  AdminTableParams,
} from "@/views/admin/table/params";

import { CONTENT_DEFAULT_PAGE_SIZE } from "@/content/const";
import { contentFilterableFields, orderableColumns } from "@/content/registry";

import type {
  AdminTableRouteSearch,
  UncheckedAdminTableSearch,
} from "../table-search";

import {
  adminTableRouteParams,
  adminTableSearchParams,
  normalizeAdminTableSearch,
} from "../table-search";

/** The filters one content type accepts, as `field -> value`. */
export type ContentListFilters = Record<string, string>;

/** The normalised request a content list URL is asking for. */
export interface ContentListParams extends AdminTableParams {
  filters: ContentListFilters;
}

export type ContentListRouteSearch = AdminTableRouteSearch &
  Record<string, unknown>;

export type UncheckedContentListSearch = UncheckedAdminTableSearch;

export const contentTableContract = (
  definition: AnyContentTypeDefinition,
): AdminTableContract => ({
  defaultPageSize: CONTENT_DEFAULT_PAGE_SIZE,
  orderBy: orderableColumns(definition),
  search: definition.admin.list.searchableFields.length > 0,
});

const readParam = (value: unknown): string | undefined => {
  const one = Array.isArray(value) ? (value[0] as unknown) : value;

  if (typeof one === "string") return one;
  if (typeof one === "number") {
    return Number.isFinite(one) ? String(one) : undefined;
  }
  if (typeof one === "boolean") return String(one);

  return undefined;
};

export const contentListFilters = (
  input: UncheckedContentListSearch,
  definition: AnyContentTypeDefinition,
): ContentListFilters => {
  const source = input as Record<string, unknown>;

  return Object.fromEntries(
    contentFilterableFields(definition)
      .map(name => [name, readParam(source[name])?.trim() ?? ""] as const)
      .filter(([, value]) => value !== "")
      .sort(([a], [b]) => a.localeCompare(b)),
  );
};

/** The request this URL is asking for - and therefore the cache key. */
export const contentListRouteParams = (
  input: UncheckedContentListSearch,
  definition: AnyContentTypeDefinition,
): ContentListParams => ({
  ...adminTableRouteParams(input, contentTableContract(definition)),
  filters: contentListFilters(input, definition),
});

export const normalizeContentListSearch = (
  input: UncheckedContentListSearch,
  definition: AnyContentTypeDefinition,
): ContentListRouteSearch => ({
  ...normalizeAdminTableSearch(input, contentTableContract(definition)),
  ...contentListFilters(input, definition),
});

/** The query string the table's own controls read themselves out of. */
export const contentListSearchParams = (
  input: UncheckedContentListSearch,
  definition: AnyContentTypeDefinition,
): URLSearchParams => {
  const params = adminTableSearchParams(
    input,
    contentTableContract(definition),
  );

  for (const [key, value] of Object.entries(
    contentListFilters(input, definition),
  )) {
    params.set(key, value);
  }

  return params;
};

export const contentListSearchFrom = (
  nextSearch: string,
  definition: AnyContentTypeDefinition,
): ContentListRouteSearch =>
  normalizeContentListSearch(
    Object.fromEntries(new URLSearchParams(nextSearch)),
    definition,
  );

export const contentListQuery = (
  params: ContentListParams,
): Record<string, string | undefined> => {
  const { filters, ...table } = params;

  return { ...filters, ...table };
};
