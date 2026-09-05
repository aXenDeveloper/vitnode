import type {
  AdminUsersOrderBy,
  AdminUsersParams,
} from "@/views/admin/views/core/users/list/users-query";

import {
  ADMIN_USERS_TABLE_CONTRACT,
  normalizeAdminRoleFilter,
} from "@/views/admin/views/core/users/list/users-query";

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

export interface UsersRouteSearch extends AdminTableRouteSearch<AdminUsersOrderBy> {
  roleId?: string;
}

export type UncheckedUsersSearch = Record<string, unknown> | UsersRouteSearch;

/** The `roleId` in whatever shape the router parsed it into. */
const readRoleFilter = (input: UncheckedUsersSearch): string | undefined => {
  const value = (input as { roleId?: unknown }).roleId;
  if (typeof value === "string") return normalizeAdminRoleFilter(value);
  if (typeof value === "number") {
    return normalizeAdminRoleFilter(String(value));
  }
  if (Array.isArray(value)) {
    // `?roleId=2&roleId=5` is the same selection as `?roleId=2,5`, and the
    // filter dropdown writes the second spelling.
    return normalizeAdminRoleFilter(
      value.filter(item => typeof item === "string").join(","),
    );
  }

  return undefined;
};

/** The request this URL is asking for, and therefore the query key. */
export const usersRouteParams = (
  input: UncheckedUsersSearch,
): AdminUsersParams => {
  const params: AdminUsersParams = adminTableRouteParams(
    input as UncheckedAdminTableSearch<AdminUsersOrderBy>,
    ADMIN_USERS_TABLE_CONTRACT,
  );
  const roleId = readRoleFilter(input);
  if (roleId !== undefined) params.roleId = roleId;

  return params;
};

/** The route's `validateSearch`: it normalises rather than rejects. */
export const normalizeUsersRouteSearch = (
  input: UncheckedUsersSearch,
): UsersRouteSearch => {
  const search: UsersRouteSearch = normalizeAdminTableSearch(
    input as UncheckedAdminTableSearch<AdminUsersOrderBy>,
    ADMIN_USERS_TABLE_CONTRACT,
  );
  const roleId = readRoleFilter(input);
  if (roleId !== undefined) search.roleId = roleId;

  return search;
};

/** The query string the table's controls read themselves out of. */
export const usersSearchParams = (
  input: UncheckedUsersSearch,
): URLSearchParams => {
  const params = adminTableSearchParams(
    input as UncheckedAdminTableSearch<AdminUsersOrderBy>,
    ADMIN_USERS_TABLE_CONTRACT,
  );
  const roleId = readRoleFilter(input);
  if (roleId !== undefined) params.set("roleId", roleId);

  return params;
};

/** A query string one of those controls produced, back as route search. */
export const usersSearchFrom = (nextSearch: string): UsersRouteSearch => {
  const parsed = Object.fromEntries(new URLSearchParams(nextSearch));
  const search: UsersRouteSearch = adminTableSearchFrom(
    nextSearch,
    ADMIN_USERS_TABLE_CONTRACT,
  );
  const roleId = readRoleFilter(parsed);
  if (roleId !== undefined) search.roleId = roleId;

  return search;
};
