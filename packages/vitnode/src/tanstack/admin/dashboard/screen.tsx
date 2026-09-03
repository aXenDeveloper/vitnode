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

import type { AdminDashboardRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminIdentity } from "../identity";
import { useAdminPermissions } from "../permissions";
import { dashboardLayoutQuery, useDashboardActions } from "./query";
import { ADMIN_DASHBOARD_NAMESPACES } from "./route";
import { coreDashboardBrowserWidgets } from "./widgets";

export interface DashboardPluginWidgets {
  pluginId: string;
  widgets: AdminDashboardWidget[];
}

export interface AdminDashboardRouteProps extends AdminDashboardRouteData {
  pluginWidgets?: DashboardPluginWidgets[];
}

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
