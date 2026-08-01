import type { PermissionsStaffArgs } from "../api/lib/permission-staff";
import type { ItemNavAdmin } from "../views/admin/layouts/sidebar/nav/item";
import type { LocaleMessagesMap } from "./i18n/types";

export type AdminNavPermission = Omit<PermissionsStaffArgs, "plugin">;

interface AdminNavItem extends Pick<
  React.ComponentProps<typeof ItemNavAdmin>,
  "href" | "icon" | "isOpenInNewTab"
> {
  id: string;
  permission?: AdminNavPermission;
}

export type AdminDashboardWidgetSpan = 1 | 2 | 3;
export type AdminDashboardWidgetRows = 1 | 2 | 3;
export type AdminDashboardWidgetSettings = Record<string, unknown>;

export interface AdminDashboardWidgetProps {
  settings: AdminDashboardWidgetSettings;
  widgetId: string;
}

export interface AdminDashboardWidget {
  allowMultiple?: boolean;
  category?: string;
  component: React.ComponentType<AdminDashboardWidgetProps>;
  defaultEnabled?: boolean;
  defaultRows?: AdminDashboardWidgetRows;
  defaultSpan?: AdminDashboardWidgetSpan;
  icon?: React.ReactNode;
  id: string;
  minSpan?: AdminDashboardWidgetSpan;
  permission?: AdminNavPermission;
  settingsComponent?: React.ComponentType<AdminDashboardWidgetProps>;
}

export interface BuildPluginReturn<P extends string = string> {
  admin?: {
    dashboard?: {
      widgets?: AdminDashboardWidget[];
    };
    nav?: (AdminNavItem & {
      items?: Omit<AdminNavItem, "icon">[];
    })[];
  };
  messages?: LocaleMessagesMap;
  pluginId: P;
}

export function buildPlugin<P extends string>(
  props: BuildPluginReturn<P>,
): BuildPluginReturn<P> {
  return props;
}
