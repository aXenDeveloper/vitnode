import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { UpdateAdminUser } from "@/views/admin/views/core/users/detail/user-fields-content";
import type {
  AdminUserDetail,
  AdminUserFetcher,
} from "@/views/admin/views/core/users/detail/user-query";
import type { UpdateAdminUserRoles } from "@/views/admin/views/core/users/detail/user-roles-content";
import type {
  AdminUsersPageFetcher,
  AdminUsersParams,
} from "@/views/admin/views/core/users/list/users-query";
import type { VerifyAdminUserEmail } from "@/views/admin/views/core/users/list/users-table-content";

import { fetcher } from "@/tanstack/fetcher";
import {
  adminUserFetcher,
  adminUserQueryOptions,
} from "@/views/admin/views/core/users/detail/user-query";
import {
  adminUsersPageFetcher,
  adminUsersQueryOptions,
  adminUsersQueryRoot,
} from "@/views/admin/views/core/users/list/users-query";
import {
  updateAdminUser,
  updateAdminUserRoles,
  verifyAdminUserEmail,
} from "@/views/admin/views/core/users/users-mutations";

import { useAdminIdentity } from "../identity";
import { invalidateAdminSession } from "../session-query";

const fetchUsersPage: AdminUsersPageFetcher = adminUsersPageFetcher(fetcher);

const fetchUser: AdminUserFetcher = adminUserFetcher(fetcher);

export const adminUsersQuery = ({
  adminUserId,
  params,
}: {
  adminUserId: AdminIdentity;
  params: AdminUsersParams;
}) =>
  adminUsersQueryOptions({
    adminUserId,
    fetchPage: fetchUsersPage,
    params,
  });

/** One user, for the detail screen and for its breadcrumb. */
export const adminUserQuery = ({
  adminUserId,
  id,
}: {
  adminUserId: AdminIdentity;
  id: string;
}) => adminUserQueryOptions({ adminUserId, fetchUser, id });

export const invalidateAdminUsers = async (
  queryClient: QueryClient,
  adminUserId: AdminIdentity,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: adminUsersQueryRoot(adminUserId),
  });
};

export const invalidateAfterAdminUserRolesChange = async (
  queryClient: QueryClient,
  adminUserId: AdminIdentity,
): Promise<void> => {
  await Promise.all([
    invalidateAdminUsers(queryClient, adminUserId),
    invalidateAdminSession(queryClient),
  ]);
};

export const useAdminUserMutations = (): {
  onUpdate: UpdateAdminUser;
  onUpdateRoles: UpdateAdminUserRoles;
  onVerifyEmail: VerifyAdminUserEmail;
} => {
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();

  return React.useMemo(
    () => ({
      onUpdate: async (id, input) => {
        const result = await updateAdminUser(id, input);
        if ("data" in result) {
          await invalidateAdminUsers(queryClient, adminUserId);
        }

        return result;
      },
      onUpdateRoles: async (id, input) => {
        const result = await updateAdminUserRoles(id, input);
        if ("data" in result) {
          await invalidateAfterAdminUserRolesChange(queryClient, adminUserId);
        }

        return result;
      },
      onVerifyEmail: async (id: number) => {
        const result = await verifyAdminUserEmail(id);
        if ("error" in result) return { error: result.error };
        await invalidateAdminUsers(queryClient, adminUserId);

        return { name: result.data.name };
      },
    }),
    [adminUserId, queryClient],
  );
};

export type { AdminUserDetail };
