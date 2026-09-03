import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminRoleFormProps } from "@/views/admin/views/core/users/roles/role-form-content";
import type {
  AdminRolesPageFetcher,
  AdminRolesParams,
} from "@/views/admin/views/core/users/roles/roles-query";
import type { RolesAdminTableProps } from "@/views/admin/views/core/users/roles/roles-table-content";

import {
  createAdminRole,
  deleteAdminRole,
  updateAdminRole,
} from "@/views/admin/views/core/users/roles/roles-mutations";
import {
  adminRolesQueryOptions,
  adminRolesQueryRoot,
  fetchAdminRolesPageInBrowser,
} from "@/views/admin/views/core/users/roles/roles-query";

import { useAdminIdentity } from "../identity";
import { invalidateAdminSession } from "../session-query";
import { invalidateAdminUsers } from "../users/query";
import { fetchAdminRolesPageOnServer } from "./server";

/**
 * The AdminCP roles screen for a TanStack Start host: one query definition and
 * three mutations.
 */

const fetchRolesPage: AdminRolesPageFetcher = createIsomorphicFn()
  .server(fetchAdminRolesPageOnServer)
  .client(fetchAdminRolesPageInBrowser);

export const adminRolesQuery = ({
  adminUserId,
  params,
}: {
  adminUserId: AdminIdentity;
  params: AdminRolesParams;
}) =>
  adminRolesQueryOptions({ adminUserId, fetchPage: fetchRolesPage, params });

export const invalidateAfterAdminRoleChange = async (
  queryClient: QueryClient,
  adminUserId: AdminIdentity,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: adminRolesQueryRoot(adminUserId),
    }),
    invalidateAdminUsers(queryClient, adminUserId),
    invalidateAdminSession(queryClient),
  ]);
};

export const useAdminRoleMutations = (): {
  onDelete: RolesAdminTableProps["onDelete"];
  onSave: AdminRoleFormProps["onSave"];
  onSaved: () => void;
} => {
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();

  return React.useMemo(
    () => ({
      onDelete: async args => {
        const result = await deleteAdminRole(args);
        if ("data" in result) {
          await invalidateAfterAdminRoleChange(queryClient, adminUserId);
        }

        return result;
      },
      onSave: async ({ id, values }) => {
        const body = {
          allowUploadFiles: values.allowUploadFiles,
          color: values.color,
          maxStorageForSubmit: values.maxStorageForSubmit,
          name: values.name,
          totalMaxStorage: values.totalMaxStorage,
        };
        const result =
          id === undefined
            ? await createAdminRole(body)
            : await updateAdminRole(id, body);
        if ("data" in result) {
          await invalidateAfterAdminRoleChange(queryClient, adminUserId);
        }

        return result;
      },
      onSaved: () => {
        // The dialogs already invalidated on success; this is the hook the
        // Next.js version uses to re-render the page, and a router with a query
        // cache needs nothing more.
      },
    }),
    [adminUserId, queryClient],
  );
};
