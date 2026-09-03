import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { CreateStaffFormProps } from "@/views/admin/views/core/staff/create/create-staff-form-content";
import type { EditStaffFormProps } from "@/views/admin/views/core/staff/edit/edit-staff-form-content";
import type {
  AdminStaffCatalogFetcher,
  AdminStaffEntryFetcher,
  AdminStaffPageFetcher,
  AdminStaffParams,
} from "@/views/admin/views/core/staff/staff-query";
import type { StaffTableProps } from "@/views/admin/views/core/staff/table/staff-table-content";

import {
  createStaffEntry,
  deleteStaffEntry,
  updateStaffPermissions,
} from "@/views/admin/views/core/staff/staff-mutations";
import {
  adminStaffCatalogQueryOptions,
  adminStaffEntryQueryOptions,
  adminStaffQueryOptions,
  adminStaffQueryRoot,
  fetchAdminStaffCatalogInBrowser,
  fetchAdminStaffEntryInBrowser,
  fetchAdminStaffPageInBrowser,
} from "@/views/admin/views/core/staff/staff-query";

import { useAdminIdentity } from "../identity";
import { invalidateAdminSession } from "../session-query";
import {
  fetchAdminStaffCatalogOnServer,
  fetchAdminStaffEntryOnServer,
  fetchAdminStaffPageOnServer,
} from "./server";

/**
 * The AdminCP staff screens for a TanStack Start host: three query definitions
 * and three mutations.
 */

const fetchStaffPage: AdminStaffPageFetcher = createIsomorphicFn()
  .server(fetchAdminStaffPageOnServer)
  .client(fetchAdminStaffPageInBrowser);

const fetchCatalog: AdminStaffCatalogFetcher = createIsomorphicFn()
  .server(fetchAdminStaffCatalogOnServer)
  .client(fetchAdminStaffCatalogInBrowser);

const fetchEntry: AdminStaffEntryFetcher = createIsomorphicFn()
  .server(fetchAdminStaffEntryOnServer)
  .client(fetchAdminStaffEntryInBrowser);

export const adminStaffQuery = ({
  adminUserId,
  params,
  type,
}: {
  adminUserId: AdminIdentity;
  params: AdminStaffParams;
  type: PermissionStaffType;
}) =>
  adminStaffQueryOptions({
    adminUserId,
    fetchPage: fetchStaffPage,
    params,
    type,
  });

export const adminStaffCatalogQuery = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) =>
  adminStaffCatalogQueryOptions({ adminUserId, fetchCatalog: fetchCatalog });

export const adminStaffEntryQuery = ({
  adminUserId,
  id,
  type,
}: {
  adminUserId: AdminIdentity;
  id: string;
  type: PermissionStaffType;
}) => adminStaffEntryQueryOptions({ adminUserId, fetchEntry, id, type });

export const invalidateAfterStaffChange = async (
  queryClient: QueryClient,
  adminUserId: AdminIdentity,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: adminStaffQueryRoot(adminUserId),
    }),
    invalidateAdminSession(queryClient),
  ]);
};

/** The delete behind a staff list's row action. */
export const useStaffDeleteCallback = (): StaffTableProps["onDelete"] => {
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();

  return React.useMemo<StaffTableProps["onDelete"]>(
    () => async args => {
      const result = await deleteStaffEntry(args);
      if ("data" in result) {
        await invalidateAfterStaffChange(queryClient, adminUserId);
      }

      return result;
    },
    [adminUserId, queryClient],
  );
};

/** The create behind `/admin/core/staff/{admins,moderators}/create`. */
export const useStaffCreateCallback = (): CreateStaffFormProps["onCreate"] => {
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();

  return React.useMemo<CreateStaffFormProps["onCreate"]>(
    () => async args => {
      const result = await createStaffEntry(args);
      if ("data" in result) {
        await invalidateAfterStaffChange(queryClient, adminUserId);
      }

      return result;
    },
    [adminUserId, queryClient],
  );
};

/** The save behind `/admin/core/staff/{admins,moderators}/edit/$id`. */
export const useStaffSaveCallback = (): EditStaffFormProps["onSave"] => {
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();

  return React.useMemo<EditStaffFormProps["onSave"]>(
    () => async args => {
      const result = await updateStaffPermissions(args);
      if ("data" in result) {
        await invalidateAfterStaffChange(queryClient, adminUserId);
      }

      return result;
    },
    [adminUserId, queryClient],
  );
};
