import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { runAdminApiMutation } from "@/views/admin/views/core/shared/admin-mutation";
import { adminScopedQueryKey } from "@/views/admin/views/core/shared/admin-scope";

import { ADMIN_AI_SCREEN } from "../ai-query";

const fetchContentTranslationSettings = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/ai",
    path: "/content-translation",
  });
  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the automatic translation settings",
    );
  }

  return await response.json();
};

export type AdminContentTranslation = Awaited<
  ReturnType<typeof fetchContentTranslationSettings>
>;

export type AdminContentTranslationInput = Omit<
  AdminContentTranslation,
  "languages" | "modelReady" | "stats"
>;

export const adminContentTranslationQueryOptions = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) =>
  queryOptions({
    queryFn: fetchContentTranslationSettings,
    queryKey: adminScopedQueryKey(
      ADMIN_AI_SCREEN,
      adminUserId,
      "content-translation",
    ),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export const updateAdminContentTranslation = async (
  body: AdminContentTranslationInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcher({
        plugin: manifest.id,
        args: { body },
        method: "put",
        module: "admin/ai",
        path: "/content-translation",
      }),
  });
