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
