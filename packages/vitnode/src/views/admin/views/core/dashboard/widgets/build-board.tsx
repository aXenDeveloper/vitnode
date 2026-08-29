import type { AdminDashboardWidgetLayoutItem } from "@/database/dashboard";

import type {
  DashboardLayoutItem,
  DashboardWidgetCatalogEntry,
  ResolvedDashboardWidget,
} from "./types";

import { widgetIdOf } from "./instance-id";
import { normalizeLayout } from "./normalize-layout";

/**
 * The four things `DashboardBoardProvider` is given, built from the two things
 * that were fetched.
 *
 * Lifted out of the Next.js `DashboardBoard` unchanged, because every line of it
 * is arithmetic over a widget list and a stored layout - which is identical in
 * both applications. What differs is only where the two inputs came from: a
 * Server Component's `fetcher()` in one, a route loader's query in the other.
 *
 * Rendering a widget is a plain `<Widget settings widgetId />` here as it was
 * there. In Next.js that call happens on the server, so a widget may be a Server
 * Component and only its output crosses the boundary; in a browser it is an
 * ordinary render. The board never learns which, because it is handed nodes.
 */
export interface DashboardBoard {
  catalog: DashboardWidgetCatalogEntry[];
  content: Record<string, React.ReactNode>;
  layout: DashboardLayoutItem[];
  managedIds: string[];
}

export const buildDashboardBoard = ({
  saved,
  widgets,
}: {
  /** The layout this admin has stored, or `[]` when they have none. */
  saved: AdminDashboardWidgetLayoutItem[];
  widgets: ResolvedDashboardWidget[];
}): DashboardBoard => {
  const layout = normalizeLayout({ saved, widgets });

  const widgetIds = new Set(widgets.map(({ id }) => id));

  /**
   * Every stored id this board is speaking for - what it placed, plus what it
   * found stored and recognised. The API needs it to tell a widget the admin
   * removed from one this board never knew about; see `zodDashboardLayout`.
   */
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
    // A stand-in is what the side panel previews. A widget already on the board
    // needs none, unless more copies of it can be dragged in.
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

  return { catalog, content, layout, managedIds };
};
