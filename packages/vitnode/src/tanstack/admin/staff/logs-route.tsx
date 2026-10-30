import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { PluginRouteTranslator } from "@/routing";
import type { ActivityRouteSearch } from "@/views/activity-logs/activity-search";

import {
  activityFilterOptionsQueryOptions,
  activityListQueryOptions,
} from "@/views/activity-logs/activity-query";
import { activityFiltersOf } from "@/views/activity-logs/activity-search";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";

export const ADMIN_STAFF_LOGS_NAMESPACES = [
  "admin.staff",
  "core.activity_logs",
  "core.global",
] as const;

export interface AdminStaffLogsRouteData {
  description: string;
  title: string;
  type: PermissionStaffType;
}

export const ACTIVITY_LOGS_MODULE = "activity_logs";

export const loadAdminStaffLogsRoute = async ({
  adminAccess,
  queryClient,
  search,
  t,
  type,
}: AdminScreenContext & {
  search: ActivityRouteSearch;
  t: PluginRouteTranslator;
  type: PermissionStaffType;
}): Promise<AdminStaffLogsRouteData> => {
  requireAdminPermission(adminAccess, {
    module: ACTIVITY_LOGS_MODULE,
    permission: "can_view",
  });

  // The filter options decide which plugin messages the screen loads, so they
  // are awaited; the first page warms alongside and the screen keeps its
  // skeleton local if it is not there yet.
  await Promise.all([
    queryClient.query({
      ...activityFilterOptionsQueryOptions(),
      staleTime: "static",
    }),
    queryClient
      .infiniteQuery({
        ...activityListQueryOptions({
          ...activityFiltersOf(search),
          staff: type,
        }),
        staleTime: "static",
      })
      .catch(() => undefined),
  ]);

  return {
    description: t(`admin.staff.logs.desc.${type}`),
    title: t(`admin.staff.logs.title.${type}`),
    type,
  };
};
