"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { CONFIG_PLUGIN } from "@/config";
import { ClearCacheAction } from "@/views/admin/views/core/debug/actions/clear-cache/clear-cache";
import { QueueViewContent } from "@/views/admin/views/core/debug/queue/queue-view-content";
import { SystemLogsContent } from "@/views/admin/views/core/debug/system-logs/system-logs-content";

import type { AdminTableNavigate } from "../table-search";
import type { AdminDebugRouteData } from "./route";
import type { DebugRouteSearch, UncheckedDebugSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { RouterLink } from "../../layout/router-link";
import { AdminPermissionGate } from "../permissions";
import { debugLogsQuery, debugQueueQuery, useClearAdminCache } from "./query";
import { ADMIN_DEBUG_NAMESPACES } from "./route";
import { DEBUG_MODULE } from "./route";
import { debugSearchFrom, debugSearchParams } from "./route-search";

export interface AdminDebugRouteProps extends AdminDebugRouteData {
  /**
   * How the log's detail dialog links to the user who caused a line.
   *
   * `/admin/core/users/{id}` is still the Next.js AdminCP's screen in Stage 12,
   * so a host mid-migration passes a link that asks its route tree per href.
   * Defaults to the router's own `Link`, which is the right answer once that
   * screen has moved.
   */
  LinkComponent?: AuthLinkComponent;
  navigate: AdminTableNavigate<DebugRouteSearch>;
  search: UncheckedDebugSearch;
}

/**
 * `/admin/core/debug`, as everything below a route file's `component`.
 *
 * The same three sections the Next.js page has, in the same order, with one
 * structural difference: there is no `<Suspense>` around the queue snapshot or
 * the log, because the loader has already fetched both. The Next.js page streams
 * them in behind skeletons; here they are in the cache before the component
 * mounts, so a boundary would be an admission the data is not there yet.
 *
 * The clear-cache button keeps its gate. `AdminPermissionGate` is the same
 * component the Next.js page mounts, reading the same permission set - and, as
 * always, hiding a control rather than authorizing one.
 */
export const AdminDebugRouteContent = ({
  description,
  LinkComponent = RouterLink,
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
        <HeaderContent desc={description} h1={title}>
          <AdminPermissionGate
            module={DEBUG_MODULE}
            permission="can_clear_cache"
            plugin={CONFIG_PLUGIN.pluginId}
          >
            <ClearCacheAction onClearCache={onClearCache} />
          </AdminPermissionGate>
        </HeaderContent>

        <HeaderContent className="mt-8" h2={queueTitle} />
        <QueueViewContent data={queue} />

        <HeaderContent className="mt-8" h2={logsTitle} />
        <DataTableNavigationProvider value={navigation}>
          <SystemLogsContent data={logs} LinkComponent={LinkComponent} />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
