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

/**
 * What a staff write invalidates, and why the admin session is on the list.
 *
 * A staff entry *is* a permission grant. Creating one, editing one or deleting
 * one changes what somebody may do in the panel - and "somebody" can be the
 * administrator pressing the button, in more ways than the obvious one:
 *
 * - The API refuses an edit or a delete of an entry that governs the caller's
 *   own access, so a *direct* self-demotion cannot happen.
 * - It does not, and cannot, refuse everything else. Two administrators can be
 *   in the panel at once, and one of them editing the other's entry changes what
 *   the other may do while their tab is open.
 * - Nothing stops an administrator granting a *role* they do not hold a
 *   permission they then acquire by other means.
 *
 * The sidebar, every permission gate and every screen guard in the AdminCP are
 * rendered from one cached entry, `["vitnode","admin-session"]`. Leaving it
 * alone after a staff write means the panel goes on offering links the API has
 * started refusing until somebody reloads the page - which is exactly what
 * `revalidatePath("/[locale]/admin", "layout")` prevents in the Next.js
 * AdminCP, and the reason this list has three entries rather than one.
 *
 * `invalidateAdminSession` rather than `removeAdminSession`: the *identity* has
 * not changed, so the current sidebar stays on screen while the fresh answer is
 * fetched. Removal is for a sign-in or a sign-out, where keeping the previous
 * answer for even one frame is the thing to avoid.
 */
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
