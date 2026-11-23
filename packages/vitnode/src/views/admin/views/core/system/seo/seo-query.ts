import type { SeoSettingsUpdate } from "@vitnode/api/lib/seo/settings";
import type { SeoAdminSettings } from "@vitnode/api/modules/admin/seo/seo.schema";

import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";

export type { SeoAdminSettings };

export const adminSeoQueryKey = adminQueryRoot("seo");

export const adminSeoQueryOptions = () =>
  queryOptions({
    queryFn: async (): Promise<SeoAdminSettings> => {
      const response = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "admin/seo",
        path: "/settings",
      });
      if (!response.ok) {
        throw new AdminRequestError(response.status, "the SEO settings");
      }

      return await response.json();
    },
    queryKey: adminSeoQueryKey,
    retry: false,
    /** {@link RECORD_STALE_TIME} - it changes when an administrator saves it. */
    staleTime: RECORD_STALE_TIME,
  });

/** Saves any subset of the SEO settings; resolves with the settings as saved. */
export const updateAdminSeoSettings = async (
  body: SeoSettingsUpdate,
): Promise<AdminMutationResult<SeoAdminSettings>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: async response => (await response.json()) as SeoAdminSettings,
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body },
        method: "patch",
        module: "admin/seo",
        options: { credentials: "include" },
        path: "/settings",
      }),
  });
