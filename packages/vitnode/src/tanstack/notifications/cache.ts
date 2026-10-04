import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type {
  NotificationItemView,
  NotificationsPage,
} from "@/views/notifications/notifications-query";

import { notificationsListRoot } from "@/views/notifications/notifications-query";

type ListData = InfiniteData<NotificationsPage> | NotificationsPage;

const mapPages = (
  data: ListData | undefined,
  map: (items: NotificationItemView[]) => NotificationItemView[],
): ListData | undefined => {
  if (!data) return data;
  if ("pages" in data) {
    return {
      ...data,
      pages: data.pages.map(page => ({ ...page, items: map(page.items) })),
    };
  }

  return { ...data, items: map(data.items) };
};

/** Patches one item in every cached list - the bell's and the page's. */
export const patchCachedNotification = (
  queryClient: QueryClient,
  userId: number,
  id: number,
  patch: null | Partial<NotificationItemView>,
): void => {
  queryClient.setQueriesData<ListData>(
    { queryKey: notificationsListRoot(userId) },
    data =>
      mapPages(data, items =>
        patch === null
          ? items.filter(item => item.id !== id)
          : items.map(item => (item.id === id ? { ...item, ...patch } : item)),
      ),
  );
};

export const markAllCachedRead = (
  queryClient: QueryClient,
  userId: number,
): void => {
  queryClient.setQueriesData<ListData>(
    { queryKey: notificationsListRoot(userId) },
    data =>
      mapPages(data, items => items.map(item => ({ ...item, unread: false }))),
  );
};

export const invalidateNotificationLists = async (
  queryClient: QueryClient,
  userId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: notificationsListRoot(userId),
  });
};
