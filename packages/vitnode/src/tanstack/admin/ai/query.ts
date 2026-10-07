import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import {
  deleteAdminAiUserOverride,
  updateAdminAiAction,
  updateAdminAiRoleAccess,
  updateAdminAiSettings,
  updateAdminAiUserOverride,
} from "@/views/admin/views/core/ai/ai-mutations";
import {
  adminAiActionsQueryOptions,
  adminAiHistoryQueryOptions,
  adminAiModelsQueryOptions,
  adminAiOverviewQueryOptions,
  adminAiQueryRoot,
  adminAiRoleAccessQueryOptions,
  adminAiRunQueryOptions,
  adminAiSettingsQueryOptions,
  adminAiUserOverrideQueryOptions,
} from "@/views/admin/views/core/ai/ai-query";

import { useAdminIdentity } from "../identity";

export const adminAiOverviewQuery = adminAiOverviewQueryOptions;
export const adminAiSettingsQuery = adminAiSettingsQueryOptions;
export const adminAiModelsQuery = adminAiModelsQueryOptions;
export const adminAiActionsQuery = adminAiActionsQueryOptions;
export const adminAiRoleAccessQuery = adminAiRoleAccessQueryOptions;
export const adminAiUserOverrideQuery = adminAiUserOverrideQueryOptions;
export const adminAiHistoryQuery = adminAiHistoryQueryOptions;
export const adminAiRunQuery = adminAiRunQueryOptions;

/**
 * Every AI screen reads from the others' data - a settings change moves the
 * overview, an action change moves history filters - so one write expires
 * them all.
 */
export const invalidateAdminAi = async (
  queryClient: QueryClient,
  adminUserId: AdminIdentity,
): Promise<void> =>
  await queryClient.invalidateQueries({
    queryKey: adminAiQueryRoot(adminUserId),
  });

type Mutation<TArgs extends unknown[], TData> = (
  ...args: TArgs
) => Promise<AdminMutationResult<TData>>;

export interface AdminAiMutations {
  deleteUserOverride: typeof deleteAdminAiUserOverride;
  updateAction: typeof updateAdminAiAction;
  updateRoleAccess: typeof updateAdminAiRoleAccess;
  updateSettings: typeof updateAdminAiSettings;
  updateUserOverride: typeof updateAdminAiUserOverride;
}

export const useAdminAiMutations = (): AdminAiMutations => {
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();

  return React.useMemo(() => {
    const settled =
      <TArgs extends unknown[], TData>(
        mutation: Mutation<TArgs, TData>,
      ): Mutation<TArgs, TData> =>
      async (...args) => {
        const result = await mutation(...args);
        if ("data" in result) {
          await invalidateAdminAi(queryClient, adminUserId);
        }

        return result;
      };

    return {
      deleteUserOverride: settled(deleteAdminAiUserOverride),
      updateAction: settled(updateAdminAiAction),
      updateRoleAccess: settled(updateAdminAiRoleAccess),
      updateSettings: settled(updateAdminAiSettings),
      updateUserOverride: settled(updateAdminAiUserOverride),
    };
  }, [adminUserId, queryClient]);
};
