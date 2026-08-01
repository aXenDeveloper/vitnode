import { getTranslations } from "next-intl/server";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { AdminDashboardWidget } from "@/lib/plugin";
import type { VitNodeConfig } from "@/vitnode.config";

import { hasStaffPermission } from "@/api/lib/staff-permission";
import { CONFIG_PLUGIN } from "@/config";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";
import { getVitNodeConfig } from "@/vitnode.config";

import type { ResolvedDashboardWidget } from "./types";

import { coreDashboardWidgets } from "./registry";

export const getDashboardWidgets = async ({
  vitNodeConfig = getVitNodeConfig(),
}: {
  vitNodeConfig?: VitNodeConfig;
} = {}): Promise<ResolvedDashboardWidget[]> => {
  const t = await getTranslations();
  const session = await getSessionAdminApi();
  const permissions: StaffPermissionSet = session?.permissions ?? {
    root: false,
    permissions: [],
  };

  const sources: {
    keyPrefix: string;
    pluginId: string;
    /** What the panel calls this plugin when a widget names no category. */
    pluginTitle: string;
    widgets: AdminDashboardWidget[];
  }[] = [
    {
      pluginId: CONFIG_PLUGIN.pluginId,
      keyPrefix: "admin.dashboard.widgets",
      pluginTitle: t("admin.global.nav.core"),
      widgets: coreDashboardWidgets,
    },
    ...vitNodeConfig.plugins.map(plugin => ({
      pluginId: plugin.pluginId,
      keyPrefix: `${plugin.pluginId}.admin.dashboard.widgets`,
      pluginTitle:
        // @ts-expect-error - key is built from the plugin id at runtime
        t.has(`${plugin.pluginId}.title`)
          ? // @ts-expect-error - key is built from the plugin id at runtime
            t(`${plugin.pluginId}.title`)
          : plugin.pluginId,
      widgets: plugin.admin?.dashboard?.widgets ?? [],
    })),
  ];

  const resolved: ResolvedDashboardWidget[] = [];

  for (const { keyPrefix, pluginId, pluginTitle, widgets } of sources) {
    for (const widget of widgets) {
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

              // @ts-expect-error - key is built from the plugin id at runtime
              title: t.has(categoryKey)
                ? // @ts-expect-error - key is built from the plugin id at runtime
                  t(categoryKey)
                : widget.category,
            }
          : { id: pluginId, title: pluginTitle },
        icon: widget.icon,
        allowMultiple: widget.allowMultiple,
        defaultEnabled: widget.defaultEnabled,
        minSpan,
        defaultSpan: widget.defaultSpan ?? minSpan,
        defaultRows: widget.defaultRows ?? 1,

        // @ts-expect-error - key is built from the plugin id at runtime
        title: t(`${key}.title`),

        // @ts-expect-error - key is built from the plugin id at runtime
        desc: t.has(`${key}.desc`) ? t(`${key}.desc`) : undefined,
      });
    }
  }

  return resolved;
};
