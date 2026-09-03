import type {
  AdminFilesOrderBy,
  AdminFilesParams,
} from "@/views/admin/views/core/system/files/files-query";

import { ADMIN_FILES_TABLE_CONTRACT } from "@/views/admin/views/core/system/files/files-query";

import type {
  AdminTableRouteSearch,
  UncheckedAdminTableSearch,
} from "../table-search";

import {
  adminTableRouteParams,
  adminTableSearchFrom,
  adminTableSearchParams,
  normalizeAdminTableSearch,
} from "../table-search";

export type AdminFilesRouteSearch = AdminTableRouteSearch<AdminFilesOrderBy>;
export type UncheckedAdminFilesSearch =
  UncheckedAdminTableSearch<AdminFilesOrderBy>;

/** The request this URL is asking for, and therefore the query key. */
export const adminFilesRouteParams = (
  input: UncheckedAdminFilesSearch,
): AdminFilesParams => adminTableRouteParams(input, ADMIN_FILES_TABLE_CONTRACT);

/** The route's `validateSearch`: it normalises rather than rejects. */
export const normalizeAdminFilesRouteSearch = (
  input: UncheckedAdminFilesSearch,
): AdminFilesRouteSearch =>
  normalizeAdminTableSearch(input, ADMIN_FILES_TABLE_CONTRACT);

/** The query string the table's controls read themselves out of. */
export const adminFilesSearchParams = (
  input: UncheckedAdminFilesSearch,
): URLSearchParams => adminTableSearchParams(input, ADMIN_FILES_TABLE_CONTRACT);

/** A query string one of those controls produced, back as route search. */
export const adminFilesSearchFrom = (
  nextSearch: string,
): AdminFilesRouteSearch =>
  adminTableSearchFrom(nextSearch, ADMIN_FILES_TABLE_CONTRACT);
