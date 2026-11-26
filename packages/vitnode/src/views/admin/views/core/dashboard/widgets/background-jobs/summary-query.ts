import type { zodCronSummary } from "@vitnode/api/modules/admin/advanced/cron/routes/summary.route";
import type { z } from "zod";

import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import {
  ADMIN_DASHBOARD_SCREEN,
  adminScopedQueryKey,
} from "@/views/admin/views/core/shared/admin-scope";

export type AdminCronSummary = z.infer<typeof zodCronSummary>;

const REFRESH_MS = 60_000;

export const fetchCronSummary = async (): Promise<AdminCronSummary> => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/advanced/cron",
    path: "/summary",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the background jobs summary");
  }

  return await response.json();
};

export const cronSummaryQueryOptions = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) =>
  queryOptions({
    queryFn: fetchCronSummary,
    queryKey: adminScopedQueryKey(
      ADMIN_DASHBOARD_SCREEN,
      adminUserId,
      "cron-summary",
    ),
    refetchInterval: REFRESH_MS,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });
