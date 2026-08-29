"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { AdminDashboardWidget } from "@/lib/plugin";
import type { DashboardWidgetTranslator } from "@/views/admin/views/core/dashboard/widgets/resolve-widgets";

import { Badge } from "@/components/ui/badge";
import { HeaderContent } from "@/components/ui/header-content";
import { CONFIG } from "@/lib/config";
import { DashboardBoardProvider } from "@/views/admin/views/core/dashboard/grid/board-provider";
import { DashboardGrid } from "@/views/admin/views/core/dashboard/grid/dashboard-grid";
import { DashboardEditActions } from "@/views/admin/views/core/dashboard/grid/edit-actions";
import { buildDashboardBoard } from "@/views/admin/views/core/dashboard/widgets/build-board";
import {
  dashboardWidgetSources,
  resolveDashboardWidgets,
} from "@/views/admin/views/core/dashboard/widgets/resolve-widgets";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { useAdminPermissions } from "../permissions";
import { dashboardLayoutQuery, useDashboardActions } from "./query";
import { coreDashboardBrowserWidgets } from "./widgets";

/**
 * `/admin/core` - the AdminCP dashboard, as everything a TanStack Start route
 * needs and nothing a route owns.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.dashboard` is the heading, the widget panel, the edit controls and both
 * core widgets. `admin.global` is there for one key - `admin.global.nav.core`,
 * which is what a widget with no category of its own is filed under - and it has
 * to be listed even though the shell warms it, because `RouteMessages` mounts
 * its provider *over* the root's rather than adding to it. `core.global` is the
 * form chrome the settings dialog renders inside.
 *
 * A host that passes plugin widgets must add those plugins' namespaces: a
 * widget's title is `<pluginId>.admin.dashboard.widgets.<id>.title`, and an
 * unwarmed namespace is a missing title rather than a missing widget.
 */
export const ADMIN_DASHBOARD_NAMESPACES = [
  "admin.dashboard",
  "admin.global",
  "core.global",
] as const;

/** What {@link loadAdminDashboardRoute} returns. */
export interface AdminDashboardRouteData {
  /** The running VitNode version, or `undefined` outside a granted session. */
  vitnodeVersion?: string;
}

/**
 * Both reads the dashboard needs, in parallel, before it renders.
 *
 * **No permission check, and that is the current tuple rather than an
 * oversight.** The Next.js page wraps nothing in `<AdminPermissionRequired>`:
 * the board reads `dashboard.can_view` through the API and falls back to the
 * default layout when that read is refused, so every administrator who can enter
 * the AdminCP can see its landing screen. `_admin`'s guard is the whole of the
 * access rule here.
 *
 * **And no title.** The Next.js page exports no `generateMetadata`, so the tab
 * keeps the site's own name; returning one here would render "VitNode - VitNode".
 * A route that says nothing inherits, which is the parity-preserving answer.
 *
 * The version is read off the admin session the guard already resolved - the
 * same value the Next.js `DashboardVersion` fetches with `getSessionAdminApi()`,
 * without the second request or the `<Suspense>` that existed to hide it. It is
 * returned raw and formatted in the component, so the sentence around it is
 * translated by the provider that has this route's namespaces.
 */
export const loadAdminDashboardRoute = async ({
  adminAccess,
  locale,
  queryClient,
}: AdminScreenContext): Promise<AdminDashboardRouteData> => {
  await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_DASHBOARD_NAMESPACES }),
    ),
    queryClient.ensureQueryData(dashboardLayoutQuery()),
  ]);

  return {
    vitnodeVersion:
      adminAccess.status === "granted"
        ? adminAccess.session.vitnode_version
        : undefined,
  };
};

/** A plugin's widgets, as a browser-side registry carries them. */
export interface DashboardPluginWidgets {
  pluginId: string;
  widgets: AdminDashboardWidget[];
}

export interface AdminDashboardRouteProps extends AdminDashboardRouteData {
  /**
   * The widgets this browser can render, on top of core's own.
   *
   * A plugin's widgets reach the Next.js board through `getVitNodeConfig()`,
   * which a host keeps out of its browser bundle - so they arrive here instead,
   * from whatever browser-side registry the host has. The same seam
   * `AdminShellContent` leaves open for nav `declarations`, and empty for the
   * same reason in Stage 12.
   */
  pluginWidgets?: DashboardPluginWidgets[];
}

/**
 * `/admin/core`, as everything below a route file's `component`.
 *
 * The provider is mounted by {@link AdminDashboardBoard}, one component down,
 * and that nesting is load-bearing: every hook it calls reads *this route's*
 * namespaces, and a hook called here would run above the provider that supplies
 * them.
 */
export const AdminDashboardRouteContent = ({
  pluginWidgets = [],
  vitnodeVersion,
}: AdminDashboardRouteProps) => (
  <RouteMessages namespaces={ADMIN_DASHBOARD_NAMESPACES}>
    <div className="p-4">
      <AdminDashboardBoard
        pluginWidgets={pluginWidgets}
        vitnodeVersion={vitnodeVersion}
      />
    </div>
  </RouteMessages>
);

/**
 * The board, assembled in the browser.
 *
 * Assembled *here* rather than in a loader because two of its three inputs are
 * React state: the widget list needs a translator and this administrator's
 * permission set, both of which are context, and the content is elements.
 * `buildDashboardBoard` and `resolveDashboardWidgets` are the same two functions
 * the Next.js Server Component runs - only where they run differs.
 *
 * `useDashboardActions` is the TanStack half of `DashboardBoardProviderNext`:
 * both produce a `DashboardActions`, which is what lets the provider, the grid,
 * the panel and the settings dialog below be the same components in both
 * applications.
 */
const AdminDashboardBoard = ({
  pluginWidgets,
  vitnodeVersion,
}: {
  pluginWidgets: DashboardPluginWidgets[];
  vitnodeVersion?: string;
}) => {
  const { data: saved } = useSuspenseQuery(dashboardLayoutQuery());
  const permissions = useAdminPermissions();
  const t = useTranslations("admin.dashboard");
  /**
   * The same provider, read without a namespace, because widget titles are
   * built from a plugin id at runtime and so cannot be typed against the message
   * tree - which is exactly what the Next.js resolver's `@ts-expect-error`s said
   * about the identical lookups.
   */
  const tAll = useTranslations() as unknown as DashboardWidgetTranslator;

  const widgets = React.useMemo(
    () =>
      resolveDashboardWidgets({
        permissions,
        sources: dashboardWidgetSources({
          coreTitle: tAll("admin.global.nav.core"),
          coreWidgets: coreDashboardBrowserWidgets,
          // `dashboardWidgetSources` takes the config's plugin shape; a browser
          // registry carries only the two fields it actually reads.
          plugins: pluginWidgets.map(({ pluginId, widgets: pluginList }) => ({
            admin: { dashboard: { widgets: pluginList } },
            pluginId,
          })),
          pluginTitle: pluginId =>
            tAll.has(`${pluginId}.title`)
              ? tAll(`${pluginId}.title`)
              : pluginId,
        }),
        t: tAll,
      }),
    [permissions, pluginWidgets, tAll],
  );

  const { catalog, content, layout, managedIds } = React.useMemo(
    () => buildDashboardBoard({ saved, widgets }),
    [saved, widgets],
  );

  const actions = useDashboardActions(widgets);

  return (
    <DashboardBoardProvider
      actions={actions}
      catalog={catalog}
      content={content}
      layout={layout}
      managedIds={managedIds}
    >
      <HeaderContent
        desc={
          vitnodeVersion ? t("version", { version: vitnodeVersion }) : undefined
        }
        h1={
          <>
            <span>VitNode</span>
            {CONFIG.node_development && (
              <Badge
                className="ml-2 bg-yellow-500 text-black hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-500"
                variant="destructive"
              >
                <AlertTriangleIcon className="size-4" /> {t("dev_mode")}
              </Badge>
            )}
          </>
        }
      >
        <DashboardEditActions />
      </HeaderContent>

      <DashboardGrid />
    </DashboardBoardProvider>
  );
};
