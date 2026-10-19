import type { MultiLangValue } from "@/lib/helpers/multi-lang";

import { fetcherClient } from "@/lib/fetcher-client";
import { manifest } from "@/manifest";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";

export interface AdminReportReasonInput {
  description: MultiLangValue;
  requiresDetails: boolean;
  title: MultiLangValue;
}

const options = { credentials: "include" } as const;

export const createAdminReportReason = async (
  body: AdminReportReasonInput,
): Promise<AdminMutationResult<{ id: number }>> =>
  await runAdminApiMutation({
    expected: 201,
    parse: async response => (await response.json()) as { id: number },
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body },
        method: "post",
        module: "admin/report-reasons",
        options,
        path: "/create",
      }),
  });

export const updateAdminReportReason = async (
  id: number,
  body: AdminReportReasonInput,
): Promise<AdminMutationResult<{ id: number }>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response => (await response.json()) as { id: number },
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body, params: { id } },
        method: "patch",
        module: "admin/report-reasons",
        options,
        path: "/{id}",
      }),
  });

export const deleteAdminReportReason = async (
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
        module: "admin/report-reasons",
        options,
        path: "/{id}",
      }),
  });

export const reorderAdminReportReasons = async (
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
        module: "admin/report-reasons",
        options,
        path: "/reorder",
      }),
  });
