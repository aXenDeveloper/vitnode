import { queryOptions } from "@tanstack/react-query";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import {
  ADMIN_REPORT_REASONS_SCREEN,
  adminScopedQueryKey,
  adminScopedQueryRoot,
} from "@/views/admin/views/core/shared/admin-scope";

const fetchAdminReportReasons = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/report-reasons",
    path: "/",
  });
  if (!response.ok) {
    throw new AdminRequestError(response.status, "the report reasons");
  }

  return (await response.json()).reasons;
};

export type AdminReportReason = Awaited<
  ReturnType<typeof fetchAdminReportReasons>
>[number];

export const adminReportReasonsQueryRoot = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_REPORT_REASONS_SCREEN, adminUserId);

export const adminReportReasonsQueryOptions = (adminUserId: AdminIdentity) =>
  queryOptions({
    queryFn: fetchAdminReportReasons,
    queryKey: adminScopedQueryKey(ADMIN_REPORT_REASONS_SCREEN, adminUserId),
    staleTime: RECORD_STALE_TIME,
  });
