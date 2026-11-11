import type { z } from "zod";

import { queryOptions, useQuery } from "@tanstack/react-query";

import type { updatesSummarySchema } from "@/api/modules/admin/plugins/updates.schema";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";

import { pluginUpdatesQueryKey } from "./plugin-updates-query";

export type AdminUpdateSummary = z.infer<typeof updatesSummarySchema>;

export const fetchUpdateSummary = async (): Promise<AdminUpdateSummary> => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/plugins",
    path: "/updates/summary",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the update summary");
  }

  return await response.json();
};

export const updateSummaryQueryKey = [
  ...pluginUpdatesQueryKey,
  "summary",
] as const;

const RUNNING_REFETCH_MS = 15_000;

export const updateSummaryQueryOptions = () =>
  queryOptions({
    queryFn: fetchUpdateSummary,
    queryKey: updateSummaryQueryKey,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: query =>
      query.state.data?.running === true ? RUNNING_REFETCH_MS : false,
  });

export const useAdminUpdateSummary = () => {
  const canView = useAdminStaffPermission(
    coreStaffPermissions.admin.plugins.canView,
  );
  const { data, isError } = useQuery({
    ...updateSummaryQueryOptions(),
    enabled: canView,
  });

  return { data: canView ? data : undefined, isError: canView && isError };
};
