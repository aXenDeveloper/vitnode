import type { PluginRouteTranslator } from "@/routing";

import {
  notificationDeliveriesQueryOptions,
  notificationsOverviewQueryOptions,
} from "@/views/admin/views/core/system/notifications/notifications-query";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";

/**
 * `/admin/core/system/notifications`, as everything a TanStack Start route
 * needs and nothing a route owns.
 */

export const ADMIN_NOTIFICATIONS_NAMESPACES = [
  "admin.system.notifications",
  "core.global",
] as const;

/** What {@link loadAdminNotificationsRoute} returns - and what `head` receives. */
export interface AdminNotificationsRouteData {
  description: string;
  title: string;
}

/** The core plugin's permission module every tuple on this screen uses. */
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
    queryClient.infiniteQuery({
      ...notificationDeliveriesQueryOptions({}),
      staleTime: "static",
    }),
  ]);

  return {
    description: t("admin.system.notifications.desc"),
    title: t("admin.system.notifications.title"),
  };
};
