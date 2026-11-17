import type { SiteStatusUpdate } from "@vitnode/api/lib/site-status";
import type { zodSiteStatusAdmin } from "@vitnode/api/modules/admin/site/site.schema";
import type { z } from "zod";

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

export type AdminSiteStatus = z.infer<typeof zodSiteStatusAdmin>;
export type AdminSiteStatusInput = SiteStatusUpdate;

export const adminSiteStatusQueryKey = adminQueryRoot("site-status");

export const adminSiteStatusQueryOptions = () =>
  queryOptions({
    queryFn: async (): Promise<AdminSiteStatus> => {
      const response = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "admin/site",
        path: "/status",
      });
      if (!response.ok) {
        throw new AdminRequestError(response.status, "the site status");
      }

      return await response.json();
    },
    queryKey: adminSiteStatusQueryKey,
    retry: false,
    /** {@link RECORD_STALE_TIME} - it changes when an administrator saves it. */
    staleTime: RECORD_STALE_TIME,
  });

export const updateAdminSiteStatus = async (
  body: AdminSiteStatusInput,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: () => true as const,
    request: async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body },
        method: "put",
        module: "admin/site",
        options: { credentials: "include" },
        path: "/status",
      }),
  });
