import type { AdminDashboardWidgetSettings } from "@/lib/plugin";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

import type { ResolvedDashboardWidget } from "./types";

import { getDashboardWidgets } from "./get-dashboard-widgets";
import { widgetIdOf } from "./instance-id";

export const getWidgetInstance = async (
  widgetId: string,
): Promise<null | {
  settings: AdminDashboardWidgetSettings;
  widget: ResolvedDashboardWidget;
}> => {
  const widgets = await getDashboardWidgets();
  const widget = widgets.find(({ id }) => id === widgetIdOf(widgetId));
  if (!widget) return null;

  const res = await fetcher(adminModule, {
    path: "/",
    method: "get",
    module: "admin/dashboard",
  });
  const saved = res.ok ? (await res.json()).widgets : [];

  return {
    widget,
    settings: saved.find(item => item.id === widgetId)?.settings ?? {},
  };
};
