import type { DashboardWidgetOption } from "../widgets/types";

export interface DashboardWidgetGroup {
  id: string;
  title: string;
  widgets: DashboardWidgetOption[];
}

export const matchesWidgetQuery = (
  widget: DashboardWidgetOption,
  query: string,
): boolean => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;

  return [widget.title, widget.desc, widget.category.title].some(field =>
    field?.toLocaleLowerCase().includes(needle),
  );
};

export const groupWidgets = ({
  query = "",
  widgets,
}: {
  query?: string;
  widgets: DashboardWidgetOption[];
}): DashboardWidgetGroup[] => {
  const groups = new Map<string, DashboardWidgetGroup>();

  for (const widget of widgets) {
    if (!matchesWidgetQuery(widget, query)) continue;

    const { id, title } = widget.category;
    const group = groups.get(id);

    if (group) {
      group.widgets.push(widget);
    } else {
      groups.set(id, { id, title, widgets: [widget] });
    }
  }

  return [...groups.values()];
};
