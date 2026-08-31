/**
 * One user, as the AdminCP detail screen reads them.
 *
 * `/admin/core/users/123` in the address bar, `$id` in the route tree, and a
 * `{id}` path parameter on a Hono route that answers `404` for anything that is
 * not a row. Between those three there is exactly one interesting decision, and
 * it is {@link normalizeAdminUserId}.
 */

import { queryOptions } from "@tanstack/react-query";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminUserRole } from "@/views/admin/views/core/users/list/users-query";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { AdminRequestError } from "@/views/admin/admin-request";
import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import {
  ADMIN_USERS_SCREEN,
  adminScopedQueryKey,
} from "@/views/admin/views/core/shared/admin-scope";
import { adminModuleRef } from "@/views/admin/views/core/users/list/users-query";

/**
 * Postgres `integer`. A `bigint`-looking id is not a row, it is a probe.
 *
 * Checked here rather than left to the API because the value also becomes a
 * cache key and a `<title>`, and `Number("9999999999999")` is a perfectly finite
 * number that the database would reject with a driver error rather than a 404.
 */
const MAX_USER_ID = 2_147_483_647;

/**
 * The id in the URL, or `null` if it cannot be one.
 *
 * `$id` matches *any* segment, so this receives whatever was typed:
 * `/admin/core/users/abc`, `/admin/core/users/1e3`, `/admin/core/users/-1`,
 * `/admin/core/users/007`. `Number()` accepts all four - as `NaN`, `1000`, `-1`
 * and `7` - and the first would reach Hono as `?id=NaN`, which is a request
 * nobody meant to make.
 *
 * A strict decimal test instead, with no sign, no exponent and no leading zero,
 * so exactly one string maps to each id. That last rule is what keeps the cache
 * honest: `007` and `7` are the same user, and accepting both would be two cache
 * entries and two fetches for one row.
 *
 * Returns the *string*, because that is what the path parameter takes and what a
 * route's params hold - converting to a number here would only mean converting
 * back at every call site.
 */
export const normalizeAdminUserId = (
  raw: null | string | string[] | undefined,
): null | string => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  if (!/^[1-9]\d*$/.test(value)) return null;

  return Number(value) <= MAX_USER_ID ? value : null;
};

/** The detail screen's user - the list's row, plus what only this route knows. */
export interface AdminUserDetail {
  avatarColor: string;
  birthday: Date | null | string;
  createdAt: Date | string;
  email: string;
  emailVerified: boolean;
  id: number;
  /** Whether this user holds administrator access, from the staff tables. */
  isAdmin: boolean;
  language: string;
  name: string;
  nameCode: string;
  newsletter: boolean;
  role: AdminUserRole;
  roleId: number;
  secondaryRoles: AdminUserRole[];
}

export type AdminUserFetcher = (id: string) => Promise<AdminUserDetail>;

export const adminUserRequest = (id: string) =>
  ({
    args: { params: { id } },
    method: "get" as const,
    module: "admin/users" as const,
    path: "/{id}" as const,
  }) as const;

/**
 * One user, fetched from the browser.
 *
 * A refusal throws, carrying its status: `404` is a link to somebody who has
 * been deleted and belongs on a not-found screen, `403` is an administrator who
 * may no longer look, and the two must not render the same way.
 */
export const fetchAdminUserInBrowser: AdminUserFetcher = async id => {
  const response = await fetcherClient(adminModuleRef, {
    ...adminUserRequest(id),
    options: { credentials: "include" },
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "a user", `id=${id}`);
  }

  return await response.json();
};

export const adminUserQueryKey = ({
  adminUserId,
  id,
}: {
  adminUserId: AdminIdentity;
  id: string;
}) => adminScopedQueryKey(ADMIN_USERS_SCREEN, adminUserId, "show", id);

export const adminUserQueryOptions = ({
  adminUserId,
  fetchUser = fetchAdminUserInBrowser,
  id,
}: {
  adminUserId: AdminIdentity;
  fetchUser?: AdminUserFetcher;
  id: string;
}) =>
  queryOptions({
    queryFn: async () => await fetchUser(id),
    queryKey: adminUserQueryKey({ adminUserId, id }),
    retry: false,
    /** {@link RECORD_STALE_TIME} - One member's record, changed by whoever last edited it. */
    staleTime: RECORD_STALE_TIME,
  });

/**
 * May this administrator edit this user?
 *
 * Two permissions, and the second one only sometimes: `users:can_edit` is the
 * baseline, and editing somebody who is *themselves* an administrator
 * additionally needs `users:can_edit_admin`. That is the rule the Next.js detail
 * screen applies with `getSessionAdminApi()` and the one the API enforces on
 * write (`assertCanEditAdminTarget`), stated here so both frontends apply the
 * same one.
 *
 * Pure: the permission set goes in, a boolean comes out. It decides what is
 * *shown*; the API decides what is allowed.
 */
export const canEditAdminUser = (
  permissions: StaffPermissionSet,
  { isAdmin }: { isAdmin: boolean },
): boolean =>
  hasStaffPermission(permissions, ADMIN_USER_PERMISSIONS.edit) &&
  (!isAdmin ||
    hasStaffPermission(permissions, ADMIN_USER_PERMISSIONS.editAdmin));
