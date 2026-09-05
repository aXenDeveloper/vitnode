import type {
  AdminStaffOrderBy,
  AdminStaffParams,
} from "@/views/admin/views/core/staff/staff-query";

import { ADMIN_STAFF_TABLE_CONTRACT } from "@/views/admin/views/core/staff/staff-query";

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

export type StaffRouteSearch = AdminTableRouteSearch<AdminStaffOrderBy>;
export type UncheckedStaffSearch = UncheckedAdminTableSearch<AdminStaffOrderBy>;

export const staffRouteParams = (
  input: UncheckedStaffSearch,
): AdminStaffParams => adminTableRouteParams(input, ADMIN_STAFF_TABLE_CONTRACT);

export const normalizeStaffRouteSearch = (
  input: UncheckedStaffSearch,
): StaffRouteSearch =>
  normalizeAdminTableSearch(input, ADMIN_STAFF_TABLE_CONTRACT);

export const staffSearchParams = (
  input: UncheckedStaffSearch,
): URLSearchParams => adminTableSearchParams(input, ADMIN_STAFF_TABLE_CONTRACT);

export const staffSearchFrom = (nextSearch: string): StaffRouteSearch =>
  adminTableSearchFrom(nextSearch, ADMIN_STAFF_TABLE_CONTRACT);
