import type { zodCronHeartbeat } from "@vitnode/api/modules/admin/advanced/cron/routes/heartbeat.route";
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

export type AdminCronHeartbeat = z.infer<typeof zodCronHeartbeat>;

const REFRESH_MS = 60_000;

export const fetchCronHeartbeat = async (): Promise<AdminCronHeartbeat> => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/advanced/cron",
    path: "/heartbeat",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the scheduler heartbeat");
  }

  return await response.json();
};

export const cronHeartbeatQueryOptions = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) =>
  queryOptions({
    queryFn: fetchCronHeartbeat,
    queryKey: adminScopedQueryKey(
      ADMIN_DASHBOARD_SCREEN,
      adminUserId,
      "cron-heartbeat",
    ),
    refetchInterval: REFRESH_MS,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });
