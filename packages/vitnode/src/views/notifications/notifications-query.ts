import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import type { NotificationSubject } from "@/lib/notifications/types";

import { CONFIG_PLUGIN } from "@/config";
import {
  OPERATIONAL_STALE_TIME,
  RECORD_STALE_TIME,
} from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

export interface NotificationActorView {
  avatarColor: string;
  avatarUrl: null | string;
  id: number;
  name: string;
  nameCode: string;
}

export interface NotificationItemView {
  activitySeq: number;
  actorCount: number;
  actors: NotificationActorView[];
  available: boolean;
  body: null | string;
  category: string;
  createdAt: Date | string;
  eventCount: number;
  id: number;
  lastActivityAt: Date | string;
  pluginId: string;
  readAt: Date | null | string;
  subject: null | { id: string; type: string };
  target: null | string;
  title: string;
  type: string;
  unread: boolean;
}

export interface NotificationsPage {
  items: NotificationItemView[];
  nextCursor: null | string;
}

export class NotificationsRequestError extends Error {
  constructor(status: number) {
    super(`The notifications API answered ${status}.`);
    this.name = "NotificationsRequestError";
    this.status = status;
  }

  readonly status: number;
}

/** Everything private to the signed-in user - dropped on sign-out. */
export const NOTIFICATIONS_IDENTITY_ROOT = ["notifications", "user"] as const;

export const notificationsListRoot = (userId: number) =>
  [...NOTIFICATIONS_IDENTITY_ROOT, userId, "list"] as const;

export interface NotificationsListFilter {
  category?: string;
  unread?: boolean;
}

export const fetchNotificationsPage = async ({
  category,
  cursor,
  limit,
  signal,
  unread,
}: NotificationsListFilter & {
  cursor?: null | string;
  limit: number;
  signal?: AbortSignal;
}): Promise<NotificationsPage> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: {
      query: {
        category,
        cursor: cursor ?? undefined,
        limit,
        unread: unread ? "true" : undefined,
      },
    },
    method: "get",
    module: "notifications",
    options: { signal },
    path: "/",
  });
  if (!response.ok) throw new NotificationsRequestError(response.status);

  return await response.json();
};

export const NOTIFICATIONS_PAGE_SIZE = 20;
export const NOTIFICATIONS_RECENT_SIZE = 8;

/** The full Notifications Center list. */
export const notificationsInfiniteQueryOptions = ({
  filter,
  userId,
}: {
  filter: NotificationsListFilter;
  userId: number;
}) =>
  infiniteQueryOptions({
    getNextPageParam: (page: NotificationsPage) => page.nextCursor ?? undefined,
    initialPageParam: null as null | string,
    queryFn: async ({ pageParam, signal }) =>
      await fetchNotificationsPage({
        ...filter,
        cursor: pageParam,
        limit: NOTIFICATIONS_PAGE_SIZE,
        signal,
      }),
    queryKey: [
      ...notificationsListRoot(userId),
      "page",
      filter.unread ? "unread" : "all",
      filter.category ?? "",
    ] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

/**
 * The few items the bell's dropdown shows. Only fetched when the dropdown
 * opens - the bell's number comes from the session, never from this list.
 */
export const recentNotificationsQueryOptions = ({
  userId,
}: {
  userId: number;
}) =>
  queryOptions({
    queryFn: async ({ signal }) =>
      await fetchNotificationsPage({
        limit: NOTIFICATIONS_RECENT_SIZE,
        signal,
      }),
    queryKey: [...notificationsListRoot(userId), "recent"] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const notificationStateQueryKey = (userId: number) =>
  [...NOTIFICATIONS_IDENTITY_ROOT, userId, "state"] as const;

export const fetchNotificationState = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "notifications",
    path: "/state",
  });
  if (!response.ok) throw new NotificationsRequestError(response.status);

  return await response.json();
};

export interface NotificationPreferenceTypeView {
  category: string;
  categoryLabel: string;
  description: null | string;
  emailModes: ("daily" | "immediate" | "none" | "weekly")[];
  id: string;
  inAppAvailable: boolean;
  label: string;
  locked: boolean;
  mandatory: boolean;
  pluginId: string;
  value: { email: "daily" | "immediate" | "none" | "weekly"; inApp: boolean };
}

export interface NotificationPreferencesView {
  digestHour: number;
  digestWeekday: number;
  timeZone: null | string;
  types: NotificationPreferenceTypeView[];
}

export const notificationPreferencesQueryKey = (userId: number) =>
  [...NOTIFICATIONS_IDENTITY_ROOT, userId, "preferences"] as const;

export const notificationPreferencesQueryOptions = ({
  userId,
}: {
  userId: number;
}) =>
  queryOptions({
    queryFn: async (): Promise<NotificationPreferencesView> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "get",
        module: "notifications",
        path: "/preferences",
      });
      if (!response.ok) throw new NotificationsRequestError(response.status);

      return await response.json();
    },
    queryKey: notificationPreferencesQueryKey(userId),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export interface NotificationSubscriptionView {
  createdAt: Date | string;
  label: null | string;
  state: "following" | "muted";
  subjectId: string;
  subjectType: string;
}

export const notificationSubscriptionsQueryKey = (userId: number) =>
  [...NOTIFICATIONS_IDENTITY_ROOT, userId, "subscriptions"] as const;

export const notificationSubscriptionsQueryOptions = ({
  userId,
}: {
  userId: number;
}) =>
  queryOptions({
    queryFn: async (): Promise<NotificationSubscriptionView[]> => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { query: {} },
        method: "get",
        module: "notifications",
        path: "/subscriptions",
      });
      if (!response.ok) throw new NotificationsRequestError(response.status);

      return (await response.json()).items;
    },
    queryKey: notificationSubscriptionsQueryKey(userId),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export const notificationSubscriptionQueryOptions = ({
  subject,
  userId,
}: {
  subject: NotificationSubject;
  userId: number;
}) =>
  queryOptions({
    queryFn: async () => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        args: {
          params: { subjectId: String(subject.id), subjectType: subject.type },
        },
        method: "get",
        module: "notifications",
        path: "/subscriptions/{subjectType}/{subjectId}",
      });
      if (!response.ok) throw new NotificationsRequestError(response.status);

      return (await response.json()).state;
    },
    queryKey: [
      ...notificationSubscriptionsQueryKey(userId),
      subject.type,
      String(subject.id),
    ] as const,
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });
