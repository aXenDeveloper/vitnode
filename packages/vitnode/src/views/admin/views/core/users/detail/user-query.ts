import type { StaffPermissionSet } from "@vitnode/api/lib/permission-staff";
import type { UserImagePolicy } from "@vitnode/api/lib/shared/user-images";

import { queryOptions } from "@tanstack/react-query";
import { hasStaffPermission } from "@vitnode/api/lib/staff-permission";
import { manifest } from "@vitnode/api/manifest";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminUserRole } from "@/views/admin/views/core/users/list/users-query";

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
  firstName: null | string;
  headline: null | string;
  id: number;
  imagePolicy: UserImagePolicy;
  isStaff: boolean;
  language: string;
  lastName: null | string;
  name: string;
  nameCode: string;
  newsletter: boolean;
  /** The open deletion request: pending, or failed and waiting for a retry. */
  pendingDeletion: null | {
    attempts: number;
    id: number;
    /** Why the last erasure attempt failed. */
    lastError: null | string;
    scheduledAt: Date | string;
    source: "admin" | "user";
    status: "failed" | "pending";
  };
  phone: null | string;
  role: AdminUserRole;
  roleId: number;
  secondaryRoles: AdminUserRole[];
  showRealName: boolean;
  timeZone: null | string;
}

export type AdminUserFetcher = (id: string) => Promise<AdminUserDetail>;

export const fetchAdminUser: AdminUserFetcher = async id => {
  const response = await fetcher({
    plugin: manifest.id,
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

export const canEditAdminUser = (
  permissions: StaffPermissionSet,
  { isStaff }: { isStaff: boolean },
): boolean =>
  hasStaffPermission(permissions, ADMIN_USER_PERMISSIONS.edit) &&
  (!isStaff ||
    hasStaffPermission(permissions, ADMIN_USER_PERMISSIONS.editAdmin));
