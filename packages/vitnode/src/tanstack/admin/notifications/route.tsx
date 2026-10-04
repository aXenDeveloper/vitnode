import type { PluginRouteTranslator } from "@/routing";

import {
  notificationsOverviewQueryOptions,
  notificationStatsQueryOptions,
} from "@/views/admin/views/core/system/notifications/notifications-query";

import type { AdminScreenContext } from "../screen";

import { getIntlRuntime } from "../../i18n/runtime";
import { requireAdminPermission } from "../screen";

export const ADMIN_NOTIFICATIONS_NAMESPACES = [
  "admin.system.notifications",
  "core.global",
] as const;

export interface AdminNotificationsRouteData {
  description: string;
  title: string;
}

export const NOTIFICATIONS_MODULE = "notifications";

const NOTIFICATIONS_VIEW_PERMISSION = {
  module: NOTIFICATIONS_MODULE,
  permission: "can_view",
} as const;

export const loadAdminNotificationsRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminNotificationsRouteData> => {
  requireAdminPermission(adminAccess, NOTIFICATIONS_VIEW_PERMISSION);

  await Promise.all([
    queryClient.query({
      ...notificationsOverviewQueryOptions(),
      staleTime: "static",
    }),
    queryClient.query({
      ...notificationStatsQueryOptions({
        range: "7d",
        timeZone: getIntlRuntime().timeZone ?? "UTC",
      }),
      staleTime: "static",
    }),
  ]);

  return {
    description: t("admin.system.notifications.desc"),
    title: t("admin.system.notifications.title"),
  };
};
