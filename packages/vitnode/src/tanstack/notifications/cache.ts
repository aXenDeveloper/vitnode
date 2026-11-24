import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";

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

const itemsOf = (data: ListData | undefined): NotificationItemView[] => {
  if (!data) return [];

  return "pages" in data ? data.pages.flatMap(page => page.items) : data.items;
};

const activityTime = (item: NotificationItemView) =>
  new Date(item.lastActivityAt).getTime();

const insertByActivity = (
  data: ListData | undefined,
  item: NotificationItemView,
): ListData | undefined => {
  if (!data || !("pages" in data)) return data;
  if (itemsOf(data).some(entry => entry.id === item.id)) return data;

  const time = activityTime(item);
  const pages = data.pages.map(page => ({ ...page, items: [...page.items] }));
  for (const page of pages) {
    const index = page.items.findIndex(entry => activityTime(entry) < time);
    if (index !== -1) {
      page.items.splice(index, 0, item);

      return { ...data, pages };
    }
  }

  const lastPage = pages.at(-1);
  if (lastPage?.nextCursor !== null) return data;
  lastPage.items.push(item);

  return { ...data, pages };
};

const isUnreadFeed = (queryKey: QueryKey) =>
  queryKey.at(-2) === "feed" && queryKey.at(-1) === "unread";

const listQueryKeys = (queryClient: QueryClient, userId: number) =>
  queryClient
    .getQueryCache()
    .findAll({ queryKey: notificationsListRoot(userId) })
    .map(query => query.queryKey);

export const patchCachedNotification = (
  queryClient: QueryClient,
  userId: number,
  id: number,
  patch: null | Partial<NotificationItemView>,
): void => {
  const queryKeys = listQueryKeys(queryClient, userId);
  const source = queryKeys
    .flatMap(queryKey => itemsOf(queryClient.getQueryData<ListData>(queryKey)))
    .find(item => item.id === id);

  for (const queryKey of queryKeys) {
    const unreadFeed = isUnreadFeed(queryKey);
    const drop = patch === null || (unreadFeed && patch.unread === false);

    queryClient.setQueryData<ListData>(queryKey, data =>
      mapPages(data, items =>
        drop
          ? items.filter(item => item.id !== id)
          : items.map(item => (item.id === id ? { ...item, ...patch } : item)),
      ),
    );

    if (unreadFeed && patch?.unread === true) {
      if (source) {
        queryClient.setQueryData<ListData>(queryKey, data =>
          insertByActivity(data, { ...source, ...patch }),
        );
      }
      void queryClient.invalidateQueries({
        exact: true,
        queryKey,
        refetchType: "none",
      });
    }
  }
};

export const markAllCachedRead = (
  queryClient: QueryClient,
  userId: number,
): void => {
  for (const queryKey of listQueryKeys(queryClient, userId)) {
    queryClient.setQueryData<ListData>(queryKey, data =>
      mapPages(data, items =>
        isUnreadFeed(queryKey)
          ? []
          : items.map(item => ({ ...item, unread: false })),
      ),
    );
  }
};

export const invalidateNotificationLists = async (
  queryClient: QueryClient,
  userId: number,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: notificationsListRoot(userId),
  });
};
