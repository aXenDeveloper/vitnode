import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { AdminDashboardWidget } from "@/lib/plugin";
import type { VitNodeConfig } from "@/vitnode.config";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { CONFIG_PLUGIN } from "@/config";

import type { ResolvedDashboardWidget } from "./types";

/** One plugin's contribution, already keyed to its own message namespace. */
export interface DashboardWidgetSource {
  /** Where this plugin's widget strings live, e.g. `blog.admin.dashboard.widgets`. */
  keyPrefix: string;
  pluginId: string;
  /** What the plugin itself is called, for widgets that declare no category. */
  pluginTitle: string;
  widgets: AdminDashboardWidget[];
}

export interface DashboardWidgetTranslator {
  (key: string): string;
  has: (key: string) => boolean;
}

export const resolveDashboardWidgets = ({
  permissions,
  sources,
  t,
}: {
  permissions: StaffPermissionSet;
  sources: DashboardWidgetSource[];
  t: DashboardWidgetTranslator;
}): ResolvedDashboardWidget[] => {
  const resolved: ResolvedDashboardWidget[] = [];

  for (const { keyPrefix, pluginId, pluginTitle, widgets } of sources) {
    for (const widget of widgets) {
      // A widget's permission is checked against the plugin that *declared* it:
      // a permission granted under core must not reveal a plugin's widget.
      if (
        widget.permission &&
        !hasStaffPermission(permissions, {
          plugin: pluginId,
          ...widget.permission,
        })
      ) {
        continue;
      }

      const key = `${keyPrefix}.${widget.id}`;
      const categoryKey = `${keyPrefix}.categories.${widget.category}`;
      const minSpan = widget.minSpan ?? 1;

      resolved.push({
        id: `${pluginId}:${widget.id}`,
        component: widget.component,
        settingsComponent: widget.settingsComponent,
        category: widget.category
          ? {
              id: `${pluginId}:${widget.category}`,
              title: t.has(categoryKey) ? t(categoryKey) : widget.category,
            }
          : { id: pluginId, title: pluginTitle },
        icon: widget.icon,
        allowMultiple: widget.allowMultiple,
        defaultEnabled: widget.defaultEnabled,
        minSpan,
        defaultSpan: widget.defaultSpan ?? minSpan,
        defaultRows: widget.defaultRows ?? 1,
        title: t(`${key}.title`),
        desc: t.has(`${key}.desc`) ? t(`${key}.desc`) : undefined,
      });
    }
  }

  return resolved;
};

/**
 * The widget sources every frontend assembles, given a plugin list and a name
 * for core.
 *
 * Shared because the *order* matters - core first, then plugins in config order,
 * which is the order the widget panel groups them in - and because the message
 * key prefixes are a convention two callers would otherwise each have to get
 * right.
 */
export const dashboardWidgetSources = ({
  coreTitle,
  coreWidgets,
  plugins,
  pluginTitle,
}: {
  coreTitle: string;
  coreWidgets: DashboardWidgetSource["widgets"];
  plugins: VitNodeConfig["plugins"];
  /** What a plugin is called, or its id when it has not named itself. */
  pluginTitle: (pluginId: string) => string;
}): DashboardWidgetSource[] => [
  {
    pluginId: CONFIG_PLUGIN.pluginId,
    keyPrefix: "admin.dashboard.widgets",
    pluginTitle: coreTitle,
    widgets: coreWidgets,
  },
  ...plugins.map(plugin => ({
    pluginId: plugin.pluginId,
    keyPrefix: `${plugin.pluginId}.admin.dashboard.widgets`,
    pluginTitle: pluginTitle(plugin.pluginId),
    widgets: plugin.admin?.dashboard?.widgets ?? [],
  })),
];
