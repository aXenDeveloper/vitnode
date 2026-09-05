import { adminQueryRoot } from "@/views/admin/table/query";

export type AdminIdentity = null | number;

export const adminScopedQueryRoot = (
  screen: string,
  adminUserId: AdminIdentity,
) => [...adminQueryRoot(screen), adminUserId] as const;

/** One cache entry under that root - a list page, or a single record. */
export const adminScopedQueryKey = (
  screen: string,
  adminUserId: AdminIdentity,
  ...rest: readonly unknown[]
) => [...adminScopedQueryRoot(screen, adminUserId), ...rest] as const;

/** The screen names used below, so a typo is a compile error rather than a miss. */
export const ADMIN_USERS_SCREEN = "users";
export const ADMIN_ROLES_SCREEN = "roles";
export const ADMIN_STAFF_SCREEN = "staff";
export const ADMIN_DASHBOARD_SCREEN = "dashboard";
