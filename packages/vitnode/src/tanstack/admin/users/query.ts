import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { UpdateAdminUser } from "@/views/admin/views/core/users/detail/user-fields-content";
import type {
  RemoveAdminUserImage,
  UploadAdminUserImage,
} from "@/views/admin/views/core/users/detail/user-images-content";
import type { AdminUserDetail } from "@/views/admin/views/core/users/detail/user-query";
import type { UpdateAdminUserRoles } from "@/views/admin/views/core/users/detail/user-roles-content";
import type { AdminUsersParams } from "@/views/admin/views/core/users/list/users-query";
import type { VerifyAdminUserEmail } from "@/views/admin/views/core/users/list/users-table-content";

import {
  adminUserQueryOptions,
  fetchAdminUser,
} from "@/views/admin/views/core/users/detail/user-query";
import {
  adminUsersQueryOptions,
  adminUsersQueryRoot,
  fetchAdminUsersPage,
} from "@/views/admin/views/core/users/list/users-query";
import {
  removeAdminUserImage,
  updateAdminUser,
  updateAdminUserRoles,
  uploadAdminUserImage,
  verifyAdminUserEmail,
} from "@/views/admin/views/core/users/users-mutations";

import { useAdminIdentity } from "../identity";
import { invalidateAdminSession } from "../session-query";

export const adminUsersQuery = ({
  adminUserId,
  params,
}: {
  adminUserId: AdminIdentity;
  params: AdminUsersParams;
}) =>
  adminUsersQueryOptions({
    adminUserId,
    fetchPage: fetchAdminUsersPage,
    params,
  });

/** One user, for the detail screen and for its breadcrumb. */
export const adminUserQuery = ({
  adminUserId,
  id,
}: {
  adminUserId: AdminIdentity;
  id: string;
}) => adminUserQueryOptions({ adminUserId, fetchUser: fetchAdminUser, id });

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

export const invalidateAfterAdminUserImageChange = async (
  queryClient: QueryClient,
  { adminUserId, userId }: { adminUserId: AdminIdentity; userId: number },
): Promise<void> => {
  await Promise.all([
    invalidateAdminUsers(queryClient, adminUserId),
    ...(adminUserId === userId ? [invalidateAdminSession(queryClient)] : []),
  ]);
};

export const useAdminUserMutations = (): {
  onRemoveImage: RemoveAdminUserImage;
  onUpdate: UpdateAdminUser;
  onUpdateRoles: UpdateAdminUserRoles;
  onUploadImage: UploadAdminUserImage;
  onVerifyEmail: VerifyAdminUserEmail;
} => {
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();

  return React.useMemo(
    () => ({
      onRemoveImage: async (id, kind) => {
        await removeAdminUserImage(id, kind);
        await invalidateAfterAdminUserImageChange(queryClient, {
          adminUserId,
          userId: id,
        });
      },
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
      onUploadImage: async (id, kind, file) => {
        await uploadAdminUserImage(id, kind, file);
        await invalidateAfterAdminUserImageChange(queryClient, {
          adminUserId,
          userId: id,
        });
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
