import type { QueryClient } from "@tanstack/react-query";

import type { PluginRouteTranslator } from "@/routing";

import {
  notificationPreferencesQueryOptions,
  notificationsTableQueryOptions,
} from "@/views/notifications/notifications-query";

import type { UncheckedNotificationsSearch } from "./route-search";

import { notificationsRouteParams } from "./route-search";

export interface NotificationsRouteData {
  description: string;
  title: string;
  userId: number;
}

export const loadNotificationsRoute = async ({
  auth,
  queryClient,
  search,
  t,
}: {
  auth: { user: { id: number } };
  queryClient: QueryClient;
  search: UncheckedNotificationsSearch;
  t: PluginRouteTranslator;
}): Promise<NotificationsRouteData> => {
  const userId = auth.user.id;

  await Promise.all([
    queryClient.query({
      ...notificationsTableQueryOptions({
        params: notificationsRouteParams(search),
        userId,
      }),
      staleTime: "static",
    }),
    queryClient.query({
      ...notificationPreferencesQueryOptions({ userId }),
      staleTime: "static",
    }),
  ]);

  return {
    description: t("core.notifications.desc"),
    title: t("core.notifications.title"),
    userId,
  };
};
