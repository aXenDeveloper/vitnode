import type { z } from "zod";

import { queryOptions, useQuery } from "@tanstack/react-query";

import type { updatesSummarySchema } from "@/api/modules/admin/plugins/routes/updates.schema";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
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

/** Under the catalog's key, so refreshing the catalog after a check refreshes this too. */
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
    // Coming back to the tab refreshes a summary older than a minute; while a
    // check runs - the daily one, or someone else's - it is asked again until
    // that check finishes.
    refetchOnWindowFocus: true,
    refetchInterval: query =>
      query.state.data?.running === true ? RUNNING_REFETCH_MS : false,
  });

/**
 * The one summary the navigation count, the security banner and the dashboard
 * widget all read - one request however many of them are on screen. Never
 * requested for staff who cannot view the plugin catalog.
 */
export const useAdminUpdateSummary = () => {
  const canView = useAdminStaffPermission({
    plugin: manifest.id,
    module: "plugins",
    permission: "can_view",
  });
  const { data, isError } = useQuery({
    ...updateSummaryQueryOptions(),
    enabled: canView,
  });

  return { data: canView ? data : undefined, isError: canView && isError };
};
