/**
 * Creating, editing and deleting a role, as browser requests.
 *
 * Same shape and same reasoning as `users-mutations.ts`: one request per
 * function, the status back as data, and no cache or navigation decided here.
 *
 * ## Deleting a role is not just a delete
 *
 * A role with members cannot simply vanish - every one of them needs a role - so
 * the API takes `?moveToRoleId=` and reassigns them. That is a rule about the
 * *request*, so {@link deleteAdminRoleArgs} states it once and both the dialog
 * and the test read it from there.
 */

import type { z } from "zod";

import type { zodCreateRoleAdminSchema } from "@/api/modules/admin/roles/routes/create.route";

import { fetcherClient } from "@/lib/fetcher-client";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";
import { adminModuleRef } from "@/views/admin/views/core/users/list/users-query";

export type AdminRoleInput = z.infer<typeof zodCreateRoleAdminSchema>;

export const createAdminRole = async (
  body: AdminRoleInput,
): Promise<AdminMutationResult<{ id: number }>> =>
  await runAdminApiMutation({
    expected: 201,
    parse: async response => (await response.json()) as { id: number },
    request: async () =>
      await fetcherClient(adminModuleRef, {
        args: { body },
        method: "post",
        module: "admin/roles",
        options: { credentials: "include" },
        path: "/create",
      }),
  });

export const updateAdminRole = async (
  id: number,
  body: AdminRoleInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient(adminModuleRef, {
        args: { body, params: { id: String(id) } },
        method: "patch",
        module: "admin/roles",
        options: { credentials: "include" },
        path: "/{id}",
      }),
  });

/**
 * The arguments one role deletion sends.
 *
 * `moveToRoleId` is *omitted* rather than sent empty when there is nobody to
 * move: `?moveToRoleId=` is a value the API would try to parse, and an empty
 * query object is the same request as no query at all.
 *
 * Pure, so the "a role with members must name a destination" rule is testable
 * without a network.
 */
export const deleteAdminRoleArgs = ({
  id,
  moveToRoleId,
}: {
  id: number;
  moveToRoleId?: number;
}) => ({
  params: { id: String(id) },
  query:
    moveToRoleId === undefined ? {} : { moveToRoleId: String(moveToRoleId) },
});

export const deleteAdminRole = async (args: {
  id: number;
  moveToRoleId?: number;
}): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient(adminModuleRef, {
        args: deleteAdminRoleArgs(args),
        method: "delete",
        module: "admin/roles",
        options: { credentials: "include" },
        path: "/{id}",
      }),
  });
