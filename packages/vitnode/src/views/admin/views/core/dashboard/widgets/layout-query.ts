import { queryOptions } from "@tanstack/react-query";

import type { adminModule } from "@/api/modules/admin/admin.module";
import type { AdminDashboardWidgetLayoutItem } from "@/database/dashboard";
import type { UniversalFetcher } from "@/lib/fetcher-client";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { adminModuleRef } from "@/views/admin/admin-request";
import {
  ADMIN_DASHBOARD_SCREEN,
  adminScopedQueryRoot,
} from "@/views/admin/views/core/shared/admin-scope";

import type { DashboardMutationResult } from "./dashboard-actions";
import type { DashboardLayoutItem } from "./types";

const adminModuleClientRef = adminModuleRef<typeof adminModule>();

/** The read, as arguments to whichever fetcher is carrying it. */
/** What the layout read resolves to: the stored items, or none. */
export type DashboardStoredLayout = AdminDashboardWidgetLayoutItem[];

export type DashboardLayoutFetcher = () => Promise<DashboardStoredLayout>;

/** The stored layout, over whichever transport the host hands in. */
export const dashboardLayoutFetcher =
  (transport: UniversalFetcher): DashboardLayoutFetcher =>
  async () => {
    const response = await transport(adminModuleClientRef, {
      method: "get",
      module: "admin/dashboard",
      path: "/",
    });

    if (!response.ok) return [];

    return (await response.json()).widgets;
  };

/** The stored layout, fetched from the browser. */
export const fetchDashboardLayoutInBrowser: DashboardLayoutFetcher =
  dashboardLayoutFetcher(fetcherClient);

export const dashboardLayoutQueryKey = (adminUserId: AdminIdentity) =>
  adminScopedQueryRoot(ADMIN_DASHBOARD_SCREEN, adminUserId);

export const dashboardLayoutQueryOptions = ({
  adminUserId,
  fetchLayout = fetchDashboardLayoutInBrowser,
}: {
  adminUserId: AdminIdentity;
  fetchLayout?: DashboardLayoutFetcher;
}) =>
  queryOptions({
    queryFn: async () => await fetchLayout(),
    queryKey: dashboardLayoutQueryKey(adminUserId),
    /** {@link RECORD_STALE_TIME} - One administrator's own board, which they may have rearranged in a second tab. */
    staleTime: RECORD_STALE_TIME,
  });

export const saveDashboardLayoutInBrowser = async ({
  managed,
  widgets,
}: {
  managed: string[];
  widgets: DashboardLayoutItem[];
}): Promise<DashboardMutationResult> => {
  try {
    const response = await fetcherClient(adminModuleClientRef, {
      args: {
        body: {
          managed,
          widgets: widgets.map(({ id, rows, span }) => ({ id, rows, span })),
        },
      },
      method: "put",
      module: "admin/dashboard",
      options: { credentials: "include" },
      path: "/layout",
    });

    if (!response.ok) return { error: await response.text() };

    return undefined;
  } catch {
    return { error: "Failed to save the dashboard layout." };
  }
};
