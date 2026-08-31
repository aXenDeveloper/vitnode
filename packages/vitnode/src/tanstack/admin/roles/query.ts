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

/**
 * What a role write invalidates, and why it is three things rather than one.
 *
 * 1. **The roles list**, obviously: the row that changed may be on any page.
 * 2. **The users list**, because a role's *name and colour* are rendered in
 *    every user row, and deleting a role moves its members into another one.
 *    The Next.js version gets this for free from `revalidatePath("/admin")`; a
 *    query cache has to be told.
 * 3. **The admin session**, because a role is a permission carrier. Editing the
 *    role the signed-in administrator holds - or deleting it and moving them
 *    into another one - changes what *they* may do, and the sidebar, every
 *    permission gate and every screen guard in the panel are rendered from that
 *    one cached entry. Without this the AdminCP would go on showing links the
 *    API has started refusing until a page refresh.
 *
 * The third is `invalidateAdminSession` rather than `removeAdminSession`: the
 * administrator has not changed, so keeping the current sidebar on screen while
 * the fresh answer is fetched is right, and removal would blank the shell.
 */
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

/**
 * The three role writes, bound to the mounted router's cache.
 *
 * Memoised, because they are props on a table that re-renders on every
 * navigation and a new identity would remount the dialogs mid-edit.
 */
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
