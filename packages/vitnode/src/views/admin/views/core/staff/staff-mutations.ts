import type {
  PermissionsStaffArgs,
  PermissionStaffType,
} from "@/api/lib/permission-staff";

import { fetcherClient } from "@/lib/fetcher-client";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";
import { adminModuleRef } from "@/views/admin/views/core/users/list/users-query";

export interface CreateStaffEntryInput {
  roleId?: number;
  type: PermissionStaffType;
  userId?: number;
}

export const createStaffEntry = async ({
  roleId,
  type,
  userId,
}: CreateStaffEntryInput): Promise<AdminMutationResult<{ id: number }>> =>
  await runAdminApiMutation({
    expected: 201,
    parse: async response => (await response.json()) as { id: number },
    request: async () =>
      await fetcherClient(adminModuleRef, {
        args: { body: { roleId, userId }, params: { type } },
        method: "post",
        module: "admin/staff",
        options: { credentials: "include" },
        path: "/entry/{type}",
      }),
  });

export interface UpdateStaffPermissionsInput {
  id: string;
  permissions: PermissionsStaffArgs[];
  type: PermissionStaffType;
  unrestricted: boolean;
}

export const updateStaffPermissions = async ({
  id,
  permissions,
  type,
  unrestricted,
}: UpdateStaffPermissionsInput): Promise<
  AdminMutationResult<{
    permissions: PermissionsStaffArgs[];
    unrestricted: boolean;
  }>
> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response =>
      (await response.json()) as {
        permissions: PermissionsStaffArgs[];
        unrestricted: boolean;
      },
    request: async () =>
      await fetcherClient(adminModuleRef, {
        args: {
          body: { permissions, unrestricted },
          params: { id, type },
        },
        method: "patch",
        module: "admin/staff",
        options: { credentials: "include" },
        path: "/entry/{type}/{id}",
      }),
  });

/** Removes a staff entry. The API answers `200` with no body. */
export const deleteStaffEntry = async ({
  id,
  type,
}: {
  id: number | string;
  type: PermissionStaffType;
}): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient(adminModuleRef, {
        args: { params: { id: String(id), type } },
        method: "delete",
        module: "admin/staff",
        options: { credentials: "include" },
        path: "/entry/{type}/{id}",
      }),
  });
