import { queryOptions } from "@tanstack/react-query";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { UserImagePolicy } from "@/lib/user-images";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminUserRole } from "@/views/admin/views/core/users/list/users-query";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { CONFIG_PLUGIN } from "@/config";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import {
  ADMIN_USERS_SCREEN,
  adminScopedQueryKey,
} from "@/views/admin/views/core/shared/admin-scope";

const MAX_USER_ID = 2_147_483_647;

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
  avatarUrl: null | string;
  birthday: Date | null | string;
  coverUrl: null | string;
  createdAt: Date | string;
  email: string;
  emailVerified: boolean;
  id: number;
  imagePolicy: UserImagePolicy;
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

export const fetchAdminUser: AdminUserFetcher = async id => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id } },
    method: "get",
    module: "admin/users",
    path: "/{id}",
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
  fetchUser = fetchAdminUser,
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
 * additionally needs `users:can_edit_admin`. That is the rule the API enforces
 * on write (`assertCanEditAdminTarget`), stated here so the detail screen
 * applies the same one.
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
