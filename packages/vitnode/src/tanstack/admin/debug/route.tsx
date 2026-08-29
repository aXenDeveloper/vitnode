"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { DebugLogsParams } from "@/views/admin/views/core/debug/debug-query";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { CONFIG_PLUGIN } from "@/config";
import { ClearCacheAction } from "@/views/admin/views/core/debug/actions/clear-cache/clear-cache";
import { QueueViewContent } from "@/views/admin/views/core/debug/queue/queue-view-content";
import { SystemLogsContent } from "@/views/admin/views/core/debug/system-logs/system-logs-content";

import type { AdminScreenContext } from "../screen";
import type { AdminTableNavigate } from "../table-search";
import type { DebugRouteSearch, UncheckedDebugSearch } from "./route-search";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { RouterLink } from "../../layout/router-link";
import { AdminPermissionGate } from "../permissions";
import { requireAdminPermission } from "../screen";
import { debugLogsQuery, debugQueueQuery, useClearAdminCache } from "./query";
import { debugSearchFrom, debugSearchParams } from "./route-search";

/**
 * `/admin/core/debug`, as everything a TanStack Start route needs and nothing a
 * route owns.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.debug` is the heading, the clear-cache dialog, the queue counters and
 * every column of the log; `admin.advanced.queue` is there for one component -
 * `QueueStatusBadge`, which the queue snapshot reuses from the queue list and
 * which reads `admin.advanced.queue.status.*`. `core.global` is the table
 * chrome. Exactly the set the Next.js page's
 * `<I18nProvider namespaces={["admin.debug", "admin.advanced.queue"]}>`
 * provides, which always adds `core.global` itself.
 */
export const ADMIN_DEBUG_NAMESPACES = [
  "admin.advanced.queue",
  "admin.debug",
  "core.global",
] as const;

/** What {@link loadAdminDebugRoute} returns, and therefore what `head` receives. */
export interface AdminDebugRouteData {
  description: string;
  logsTitle: string;
  params: DebugLogsParams;
  queueTitle: string;
  title: string;
}

/** The core plugin's `debug` module - both tuples on this screen use it. */
const DEBUG_MODULE = "debug";

/**
 * The tuple both `<AdminPermissionRequired>` wrappers state in the Next.js page,
 * and the one `logsDebugAdminRoute` and `queueDebugAdminRoute` both declare.
 *
 * It gates the *screen*, not a section: in Next.js either wrapper answering "no"
 * calls `notFound()`, which replaces the whole page. Checking it once in the
 * loader is the same rule stated where it can be acted on before anything is
 * fetched.
 */
const DEBUG_VIEW_PERMISSION = {
  module: DEBUG_MODULE,
  permission: "can_view",
} as const;

/**
 * All three reads this screen needs, in parallel, before it renders.
 *
 * The permission is checked first, so an administrator who may not open the
 * panel never sends either request.
 *
 * Both API refusals are left to propagate. An errored log rendered as an empty
 * table says "nothing has gone wrong", which on the one screen an operator opens
 * *because* something has gone wrong is the worst available answer.
 *
 * The two section headings are resolved here alongside the page title, so every
 * string on the screen comes from one translator call per navigation - which is
 * what `getTranslations` gives the Next.js page for free.
 */
export const loadAdminDebugRoute = async ({
  adminAccess,
  locale,
  params,
  queryClient,
}: AdminScreenContext & {
  params: DebugLogsParams;
}): Promise<AdminDebugRouteData> => {
  requireAdminPermission(adminAccess, DEBUG_VIEW_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_DEBUG_NAMESPACES }),
    ),
    queryClient.ensureQueryData(debugQueueQuery()),
    queryClient.ensureQueryData(debugLogsQuery({ params })),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: {
        debug: {
          desc: string;
          logs: { title: string };
          queue: { title: string };
          title: string;
        };
      };
    },
    namespace: "admin.debug",
  });

  return {
    description: t("desc"),
    logsTitle: t("logs.title"),
    params,
    queueTitle: t("queue.title"),
    title: t("title"),
  };
};

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
