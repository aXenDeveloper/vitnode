import { queryOptions } from "@tanstack/react-query";

import type { MultiLangValue } from "@/lib/helpers/multi-lang";
import type { WarningThresholdAction } from "@/lib/moderation/warnings";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";
import {
  ADMIN_WARNING_REASONS_SCREEN,
  ADMIN_WARNING_THRESHOLDS_SCREEN,
  adminScopedQueryKey,
  adminScopedQueryRoot,
} from "@/views/admin/views/core/shared/admin-scope";

const fetchWarningReasons = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/warnings",
    path: "/reasons",
  });
  if (!response.ok) {
    throw new AdminRequestError(response.status, "the warning reasons");
  }

  return (await response.json()).reasons;
};

export type AdminWarningReason = Awaited<
  ReturnType<typeof fetchWarningReasons>
>[number];

export const adminWarningReasonsQueryRoot = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_WARNING_REASONS_SCREEN, adminUserId);

export const adminWarningReasonsQueryOptions = (adminUserId: AdminIdentity) =>
  queryOptions({
    queryFn: fetchWarningReasons,
    queryKey: adminScopedQueryKey(ADMIN_WARNING_REASONS_SCREEN, adminUserId),
    staleTime: RECORD_STALE_TIME,
  });

const fetchWarningThresholds = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/warnings",
    path: "/thresholds",
  });
  if (!response.ok) {
    throw new AdminRequestError(response.status, "the warning thresholds");
  }

  return (await response.json()).thresholds;
};

export type AdminWarningThreshold = Awaited<
  ReturnType<typeof fetchWarningThresholds>
>[number];

export const adminWarningThresholdsQueryRoot = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_WARNING_THRESHOLDS_SCREEN, adminUserId);

export const adminWarningThresholdsQueryOptions = (
  adminUserId: AdminIdentity,
) =>
  queryOptions({
    queryFn: fetchWarningThresholds,
    queryKey: adminScopedQueryKey(ADMIN_WARNING_THRESHOLDS_SCREEN, adminUserId),
    staleTime: RECORD_STALE_TIME,
  });

export interface AdminWarningReasonInput {
  description: MultiLangValue;
  enabled: boolean;
  expiresAfterHours: null | number;
  message: MultiLangValue;
  points: number;
  title: MultiLangValue;
}

const options = { credentials: "include" } as const;

export const saveAdminWarningReason = async ({
  id,
  values,
}: {
  id?: number;
  values: AdminWarningReasonInput;
}): Promise<AdminMutationResult<{ id: number }>> =>
  await runAdminApiMutation({
    expected: id === undefined ? 201 : 200,
    parse: async response => (await response.json()) as { id: number },
    request: async () =>
      id === undefined
        ? await fetcherClient({
            plugin: manifest.id,
            args: { body: values },
            method: "post",
            module: "admin/warnings",
            options,
            path: "/reasons",
          })
        : await fetcherClient({
            plugin: manifest.id,
            args: { body: values, params: { id } },
            method: "patch",
            module: "admin/warnings",
            options,
            path: "/reasons/{id}",
          }),
  });

export const reorderAdminWarningReasons = async (
  ids: number[],
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { ids } },
        method: "put",
        module: "admin/warnings",
        options,
        path: "/reasons/reorder",
      }),
  });

export interface AdminWarningThresholdInput {
  action: WarningThresholdAction;
  durationHours: null | number;
  enabled: boolean;
  points: number;
}

export const saveAdminWarningThreshold = async ({
  id,
  values,
}: {
  id?: number;
  values: AdminWarningThresholdInput;
}): Promise<AdminMutationResult<{ id: number }>> =>
  await runAdminApiMutation({
    expected: id === undefined ? 201 : 200,
    parse: async response => (await response.json()) as { id: number },
    request: async () =>
      id === undefined
        ? await fetcherClient({
            plugin: manifest.id,
            args: { body: values },
            method: "post",
            module: "admin/warnings",
            options,
            path: "/thresholds",
          })
        : await fetcherClient({
            plugin: manifest.id,
            args: { body: values, params: { id } },
            method: "put",
            module: "admin/warnings",
            options,
            path: "/thresholds/{id}",
          }),
  });

export const deleteAdminWarningThreshold = async (
  id: number,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { params: { id } },
        method: "delete",
        module: "admin/warnings",
        options,
        path: "/thresholds/{id}",
      }),
  });
