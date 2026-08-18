import { adminModule } from "@/api/modules/admin/admin.module";
import { HeaderContent } from "@/components/ui/header-content";
import { fetcher } from "@/lib/fetcher";

import type {
  DashboardHeaderContent,
  DashboardWidgetCatalogEntry,
} from "./widgets/types";

import { DashboardBoardProvider } from "./grid/board-provider";
import { DashboardGrid } from "./grid/dashboard-grid";
import { DashboardEditActions } from "./grid/edit-actions";
import { getDashboardWidgets } from "./widgets/get-dashboard-widgets";
import { widgetIdOf } from "./widgets/instance-id";
import { normalizeLayout } from "./widgets/normalize-layout";

export const DashboardBoard = async ({
  header,
}: {
  header: DashboardHeaderContent;
}) => {
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
  const managedIds = [
    ...new Set([
      ...saved
        .filter(item => widgetIds.has(widgetIdOf(item.id)))
        .map(item => item.id),
      ...layout.map(item => item.id),
    ]),
  ];

  const placedWidgetIds = new Set(layout.map(item => widgetIdOf(item.id)));
  const content: Record<string, React.ReactNode> = {};

  for (const item of layout) {
    const widget = widgets.find(({ id }) => id === widgetIdOf(item.id));
    if (!widget) continue;

    const Widget = widget.component;
    content[item.id] = (
      <Widget settings={item.settings ?? {}} widgetId={item.id} />
    );
  }

  const catalog: DashboardWidgetCatalogEntry[] = widgets.map(widget => {
    const Widget = widget.component;
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

      hasSettings: !!widget.settingsComponent,
    };
  });

  return (
    <DashboardBoardProvider
      catalog={catalog}
      content={content}
      layout={layout}
      managedIds={managedIds}
    >
      <HeaderContent desc={header.desc} h1={header.h1}>
        <DashboardEditActions />
      </HeaderContent>

      <DashboardGrid />
    </DashboardBoardProvider>
  );
};
