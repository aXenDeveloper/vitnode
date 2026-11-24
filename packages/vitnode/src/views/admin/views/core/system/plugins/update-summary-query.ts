import type { updatesSummarySchema } from "@vitnode/api/modules/admin/plugins/updates.schema";
import type { z } from "zod";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import { coreStaffPermissions } from "@vitnode/api/lib/core-staff-permissions";
import { manifest } from "@vitnode/api/manifest";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
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

/**
 * The plugin update summary for the header pill, sidebar badges and dashboard
 * widget. `undefined` until hydration: the server never fetches it, so cached
 * data must not reach a boundary that hydrates later than the shell.
 */
export const useAdminUpdateSummary = () => {
  const canView = useAdminStaffPermission(
    coreStaffPermissions.admin.plugins.canView,
  );
  const hydrated = useHydrated();
  const { data, isError } = useQuery({
    ...updateSummaryQueryOptions(),
    enabled: canView,
  });
  const visible = canView && hydrated;

  return { data: visible ? data : undefined, isError: visible && isError };
};
