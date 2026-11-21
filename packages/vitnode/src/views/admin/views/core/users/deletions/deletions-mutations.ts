import { manifest } from "@vitnode/api/manifest";

import { fetcherClient } from "@/lib/fetcher-client";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";

const OPTIONS = { credentials: "include" } as const;

export interface DeleteAdminUserResult {
  filesKept: number;
  scheduledAt: Date | null | string;
  status: "completed" | "scheduled";
}

/** Erases the account now, or schedules it with the member's grace period. */
export const deleteAdminUser = async (
  id: number,
  { immediately }: { immediately: boolean },
): Promise<AdminMutationResult<DeleteAdminUserResult>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response => (await response.json()) as DeleteAdminUserResult,
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { immediately }, params: { id: String(id) } },
        method: "delete",
        module: "admin/users",
        options: OPTIONS,
        path: "/{id}",
      }),
  });

export const retryAccountDeletion = async (
  deletionId: number,
): Promise<AdminMutationResult<{ status: "completed" | "failed" }>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response =>
      (await response.json()) as { status: "completed" | "failed" },
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { params: { deletionId: String(deletionId) } },
        method: "post",
        module: "admin/users",
        options: OPTIONS,
        path: "/account-deletions/{deletionId}/retry",
      }),
  });

export const cancelAdminAccountDeletion = async (
  deletionId: number,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { params: { deletionId: String(deletionId) } },
        method: "delete",
        module: "admin/users",
        options: OPTIONS,
        path: "/account-deletions/{deletionId}",
      }),
  });
