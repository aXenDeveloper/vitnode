import type {
  AdminRolesOrderBy,
  AdminRolesParams,
} from "@/views/admin/views/core/users/roles/roles-query";

import { ADMIN_ROLES_TABLE_CONTRACT } from "@/views/admin/views/core/users/roles/roles-query";

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

/**
 * The roles list's URL contract - the shared admin-table one, with this screen's
 * declaration already applied.
 *
 * Bound here rather than at the route so a host writes `validateSearch:
 * normalizeRolesRouteSearch` instead of restating which columns this table
 * sorts by. Every rule these four apply is `tanstack/admin/table-search.ts`'.
 */

export type RolesRouteSearch = AdminTableRouteSearch<AdminRolesOrderBy>;
export type UncheckedRolesSearch = UncheckedAdminTableSearch<AdminRolesOrderBy>;

export const rolesRouteParams = (
  input: UncheckedRolesSearch,
): AdminRolesParams => adminTableRouteParams(input, ADMIN_ROLES_TABLE_CONTRACT);

export const normalizeRolesRouteSearch = (
  input: UncheckedRolesSearch,
): RolesRouteSearch =>
  normalizeAdminTableSearch(input, ADMIN_ROLES_TABLE_CONTRACT);

export const rolesSearchParams = (
  input: UncheckedRolesSearch,
): URLSearchParams => adminTableSearchParams(input, ADMIN_ROLES_TABLE_CONTRACT);

export const rolesSearchFrom = (nextSearch: string): RolesRouteSearch =>
  adminTableSearchFrom(nextSearch, ADMIN_ROLES_TABLE_CONTRACT);
