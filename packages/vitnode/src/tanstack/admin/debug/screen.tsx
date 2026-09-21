import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { PageTitle } from "@/components/ui/page-title";
import { CONFIG_PLUGIN } from "@/config";
import { ClearCacheAction } from "@/views/admin/views/core/debug/actions/clear-cache/clear-cache";
import { QueueViewContent } from "@/views/admin/views/core/debug/queue/queue-view-content";
import { SystemLogsContent } from "@/views/admin/views/core/debug/system-logs/system-logs-content";

import type { AdminTableNavigate } from "../table-search";
import type { AdminDebugRouteData } from "./route";
import type { DebugRouteSearch, UncheckedDebugSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { AdminPermissionGate } from "../permissions";
import { debugLogsQuery, debugQueueQuery, useClearAdminCache } from "./query";
import { ADMIN_DEBUG_NAMESPACES } from "./route";
import { DEBUG_MODULE } from "./route";
import { debugSearchFrom, debugSearchParams } from "./route-search";

export interface AdminDebugRouteProps extends AdminDebugRouteData {
  navigate: AdminTableNavigate<DebugRouteSearch>;
  search: UncheckedDebugSearch;
}

export const AdminDebugRouteContent = ({
  description,
  logsTitle,
  navigate,
  params,
  queueTitle,
  search,
  title,
}: AdminDebugRouteProps) => {
  const { data: queue } = useSuspenseQuery(debugQueueQuery());
  const { data: logs } = useSuspenseQuery(debugLogsQuery({ params }));
  const onClearCache = useClearAdminCache();

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: debugSearchFrom(nextSearch),
        });
      },
      searchParams: debugSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={ADMIN_DEBUG_NAMESPACES}>
      <div className="p-4">
        <PageTitle desc={description} h1={title}>
          <AdminPermissionGate
            module={DEBUG_MODULE}
            permission="can_clear_cache"
            plugin={CONFIG_PLUGIN.pluginId}
          >
            <ClearCacheAction onClearCache={onClearCache} />
          </AdminPermissionGate>
        </PageTitle>

        <PageTitle className="mt-8" h2={queueTitle} />
        <QueueViewContent data={queue} />

        <PageTitle className="mt-8" h2={logsTitle} />
        <DataTableNavigationProvider value={navigation}>
          <SystemLogsContent data={logs} />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
