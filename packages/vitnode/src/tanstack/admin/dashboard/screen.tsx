import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { AdminNavDashboardWidgets } from "@/views/admin/layouts/sidebar/nav/nav-model";
import type { DashboardWidgetTranslator } from "@/views/admin/views/core/dashboard/widgets/resolve-widgets";

import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/ui/page-title";
import { CONFIG } from "@/lib/config";
import { fitNamespaceList } from "@/routing";
import { DashboardBoardProvider } from "@/views/admin/views/core/dashboard/grid/board-provider";
import { DashboardGrid } from "@/views/admin/views/core/dashboard/grid/dashboard-grid";
import { DashboardEditActions } from "@/views/admin/views/core/dashboard/grid/edit-actions";
import { buildDashboardBoard } from "@/views/admin/views/core/dashboard/widgets/build-board";
import {
  dashboardWidgetSources,
  resolveDashboardWidgets,
} from "@/views/admin/views/core/dashboard/widgets/resolve-widgets";

import type { AdminDashboardRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminIdentity } from "../identity";
import { useAdminDashboardPluginWidgets } from "../nav";
import { useAdminPermissions } from "../permissions";
import { dashboardLayoutQuery, useDashboardActions } from "./query";
import { ADMIN_DASHBOARD_NAMESPACES } from "./route";
import { coreDashboardBrowserWidgets } from "./widgets";

/** One plugin's dashboard widgets, keyed by the plugin that declared them. */
export type DashboardPluginWidgets = AdminNavDashboardWidgets;

export interface AdminDashboardRouteProps extends AdminDashboardRouteData {
  /**
   * Plugin widgets to offer next to core's. Defaults to the ones the AdminCP
   * shell was given: each plugin's `adminNav.admin.dashboard.widgets`, from
   * the app's generated `admin-nav.gen.ts`.
   */
  pluginWidgets?: DashboardPluginWidgets[];
}

/**
 * The AdminCP dashboard screen: the admin's widget board, saved per admin,
 * with core's widgets plus the plugins'. Widgets the admin lacks the
 * permission for are left out. Loads each widget plugin's `title` and
 * `admin.dashboard.widgets` messages on top of the dashboard's own.
 */
export const AdminDashboardRouteContent = ({
  pluginWidgets,
  vitnodeVersion,
}: AdminDashboardRouteProps) => {
  const shellWidgets = useAdminDashboardPluginWidgets();
  const widgets = pluginWidgets ?? shellWidgets;
  const namespaces = React.useMemo(
    () =>
      fitNamespaceList([
        ...ADMIN_DASHBOARD_NAMESPACES,
        ...widgets.flatMap(({ pluginId }) => [
          `${pluginId}.title`,
          `${pluginId}.admin.dashboard.widgets`,
        ]),
      ]),
    [widgets],
  );

  return (
    <RouteMessages namespaces={namespaces}>
      <div className="p-6">
        <AdminDashboardBoard
          pluginWidgets={widgets}
          vitnodeVersion={vitnodeVersion}
        />
      </div>
    </RouteMessages>
  );
};

const AdminDashboardBoard = ({
  pluginWidgets,
  vitnodeVersion,
}: {
  pluginWidgets: DashboardPluginWidgets[];
  vitnodeVersion?: string;
}) => {
  const adminUserId = useAdminIdentity();
  const { data: saved } = useSuspenseQuery(dashboardLayoutQuery(adminUserId));
  const permissions = useAdminPermissions();
  const t = useTranslations("admin.dashboard");

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
      <PageTitle
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
      </PageTitle>

      <DashboardGrid />
    </DashboardBoardProvider>
  );
};
