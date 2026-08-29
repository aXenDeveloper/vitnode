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

/**
 * The three writes the staff screens make, as browser requests.
 *
 * Create an entry, replace its permissions, remove it. Each returns the status
 * rather than throwing it, because each has a refusal the screen has to explain
 * rather than merely report:
 *
 *     409  on create   that role or user is already staff
 *     403  on edit     the entry is protected, or it governs your own access
 *     403  on delete   the same two, and the API will not let you demote yourself
 *     404             the entry was removed while the form was open
 *
 * The `403`s are the interesting ones and they are *deliberately* server-side
 * only. `update-permissions.route.ts` and `delete.route.ts` both re-derive the
 * caller's own roles and refuse an entry that governs them, so an administrator
 * cannot escalate or lock themselves out. The forms hide those rows using the
 * `self` and `protected` flags the list already carries, but hiding is a
 * courtesy - the refusal is the rule.
 */

export interface CreateStaffEntryInput {
  roleId?: number;
  type: PermissionStaffType;
  userId?: number;
}

/**
 * Adds a role or a user to a staff group. Exactly one of the two, which the API
 * enforces with a refinement - sending both, or neither, is a `400`.
 *
 * The new entry grants nothing until its permissions are chosen, which is why
 * the id comes back: the screen navigates straight to the edit form.
 */
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

/**
 * Replaces an entry's whole permission set.
 *
 * A replacement rather than a diff, matching the API: the form holds the
 * complete intended set, and "add these, remove those" would let two
 * administrators editing at once produce a set neither of them chose.
 *
 * The API answers with the set it actually stored, after dropping anything not
 * in the catalog and anything whose dependencies are missing. That is returned
 * rather than discarded so a caller can compare it against what it sent -
 * `staffPermissionsForSubmit` applies the same two rules, so the two should
 * agree, and a disagreement means the catalog changed under the form.
 */
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
