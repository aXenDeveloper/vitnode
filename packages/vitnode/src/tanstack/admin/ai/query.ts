import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import {
  deleteAdminAiPricing,
  deleteAdminAiUserOverride,
  sweepAdminAiAlt,
  syncAdminAiPricing,
  testAdminAiAction,
  updateAdminAiAction,
  updateAdminAiPricing,
  updateAdminAiRoleAccess,
  updateAdminAiSettings,
  updateAdminAiUserOverride,
} from "@/views/admin/views/core/ai/ai-mutations";
import {
  adminAiAccessQueryOptions,
  adminAiActionsQueryOptions,
  adminAiAltStatusQueryOptions,
  adminAiHistoryQueryOptions,
  adminAiModelsQueryOptions,
  adminAiOverviewQueryOptions,
  adminAiQueryRoot,
  adminAiRunQueryOptions,
  adminAiSettingsQueryOptions,
} from "@/views/admin/views/core/ai/ai-query";

import { useAdminIdentity } from "../identity";

export const adminAiOverviewQuery = adminAiOverviewQueryOptions;
export const adminAiSettingsQuery = adminAiSettingsQueryOptions;
export const adminAiAltStatusQuery = adminAiAltStatusQueryOptions;
export const adminAiModelsQuery = adminAiModelsQueryOptions;
export const adminAiActionsQuery = adminAiActionsQueryOptions;
export const adminAiAccessQuery = adminAiAccessQueryOptions;
export const adminAiHistoryQuery = adminAiHistoryQueryOptions;
export const adminAiRunQuery = adminAiRunQueryOptions;

/**
 * Every AI screen reads from the others' data - a price change moves the
 * overview's estimates, a test run lands in history - so one write expires
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
  deletePricing: typeof deleteAdminAiPricing;
  deleteUserOverride: typeof deleteAdminAiUserOverride;
  sweepAlt: typeof sweepAdminAiAlt;
  syncPricing: typeof syncAdminAiPricing;
  testAction: typeof testAdminAiAction;
  updateAction: typeof updateAdminAiAction;
  updatePricing: typeof updateAdminAiPricing;
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
      deletePricing: settled(deleteAdminAiPricing),
      deleteUserOverride: settled(deleteAdminAiUserOverride),
      sweepAlt: settled(sweepAdminAiAlt),
      syncPricing: settled(syncAdminAiPricing),
      testAction: settled(testAdminAiAction),
      updateAction: settled(updateAdminAiAction),
      updatePricing: settled(updateAdminAiPricing),
      updateRoleAccess: settled(updateAdminAiRoleAccess),
      updateSettings: settled(updateAdminAiSettings),
      updateUserOverride: settled(updateAdminAiUserOverride),
    };
  }, [adminUserId, queryClient]);
};
