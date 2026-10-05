import type { QueryClient } from "@tanstack/react-query";

import type { PluginRouteTranslator } from "@/routing";

import {
  notificationPreferencesQueryOptions,
  notificationsInfiniteQueryOptions,
} from "@/views/notifications/notifications-query";

import type { NotificationsRouteSearch } from "./route-search";

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
  search: NotificationsRouteSearch;
  t: PluginRouteTranslator;
}): Promise<NotificationsRouteData> => {
  const userId = auth.user.id;

  await Promise.all([
    queryClient.infiniteQuery({
      ...notificationsInfiniteQueryOptions({
        filter: {
          category: search.category,
          unread: search.filter === "unread",
        },
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
