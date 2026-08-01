import { AlertTriangleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { I18nProvider } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { HeaderContent } from "@/components/ui/header-content";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";
import { CONFIG } from "@/lib/config";
import { fetcher } from "@/lib/fetcher";

import type { DashboardWidgetCatalogEntry } from "./widgets/types";

import { DashboardBoardProvider } from "./grid/board-provider";
import { DashboardGrid } from "./grid/dashboard-grid";
import { DashboardEditActions } from "./grid/edit-actions";
import { getDashboardWidgets } from "./widgets/get-dashboard-widgets";
import { widgetIdOf } from "./widgets/instance-id";
import { normalizeLayout } from "./widgets/normalize-layout";

export const DashboardAdminView = async () => {
  const session = await getSessionAdminApi();
  const t = await getTranslations("admin.dashboard");
  if (!session) return null;
  const { vitnode_version } = session;

  const [widgets, res] = await Promise.all([
    getDashboardWidgets(),
    fetcher(adminModule, {
      path: "/",
      method: "get",
      module: "admin/dashboard",
    }),
  ]);

  const saved = res.ok ? (await res.json()).widgets : [];
  const layout = normalizeLayout({ saved, widgets });

  const widgetIds = new Set(widgets.map(({ id }) => id));
  const managedIds = saved
    .filter(item => widgetIds.has(widgetIdOf(item.id)))
    .map(item => item.id);

  const placedWidgetIds = new Set(layout.map(item => widgetIdOf(item.id)));
  const content: Record<string, React.ReactNode> = {};

  const settingsContent: Record<string, React.ReactNode> = {};

  for (const item of layout) {
    const widget = widgets.find(({ id }) => id === widgetIdOf(item.id));
    if (!widget) continue;

    const Widget = widget.component;
    content[item.id] = (
      <Widget settings={item.settings ?? {}} widgetId={item.id} />
    );

    const Settings = widget.settingsComponent;
    if (Settings) {
      settingsContent[item.id] = (
        <Settings settings={item.settings ?? {}} widgetId={item.id} />
      );
    }
  }

  const catalog: DashboardWidgetCatalogEntry[] = widgets.map(widget => {
    const Widget = widget.component;
    const Settings = widget.settingsComponent;
    const needsStandIn =
      !!widget.allowMultiple || !placedWidgetIds.has(widget.id);

    return {
      id: widget.id,
      title: widget.title,
      desc: widget.desc,
      icon: widget.icon,
      category: widget.category,
      allowMultiple: widget.allowMultiple,
      minSpan: widget.minSpan,
      defaultSpan: widget.defaultSpan,
      defaultRows: widget.defaultRows,

      content: needsStandIn ? (
        <Widget settings={{}} widgetId={widget.id} />
      ) : null,

      settingsContent:
        Settings && needsStandIn ? (
          <Settings settings={{}} widgetId={widget.id} />
        ) : undefined,
    };
  });

  return (
    <div className="p-4">
      <I18nProvider namespaces={["admin.dashboard"]}>
        <DashboardBoardProvider
          catalog={catalog}
          content={content}
          layout={layout}
          managedIds={managedIds}
          settingsContent={settingsContent}
        >
          <HeaderContent
            desc={t("version", { version: vitnode_version })}
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
      </I18nProvider>
    </div>
  );
};
