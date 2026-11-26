import type { NotificationEmailMode } from "@vitnode/api/lib/notifications/types";

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

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

export const NOTIFICATIONS_IDENTITY_ROOT = ["notifications", "user"] as const;

export const notificationsListRoot = (userId: number) =>
  [...NOTIFICATIONS_IDENTITY_ROOT, userId, "list"] as const;

export const fetchNotificationsPage = async ({
  cursor,
  limit,
  signal,
  type,
  unread,
}: {
  cursor?: string;
  limit: number;
  signal?: AbortSignal;
  type?: string;
  unread?: boolean;
}): Promise<NotificationsPage> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: {
      query: {
        limit,
        ...(cursor === undefined ? {} : { cursor }),
        ...(type === undefined ? {} : { type }),
        ...(unread ? { unread: "true" as const } : {}),
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

const NOTIFICATIONS_RECENT_SIZE = 8;
const NOTIFICATIONS_FEED_PAGE_SIZE = 20;
const MENTION_NOTIFICATION_TYPE = "core.mention";

export const NOTIFICATIONS_FEED_FILTERS = [
  "unread",
  "mentions",
  "all",
] as const;
export type NotificationsFeedFilter =
  (typeof NOTIFICATIONS_FEED_FILTERS)[number];

/**
 * The bell dropdown's infinite feed for one filter: `unread`, `all` or
 * `mentions`, newest activity first, 20 per page by cursor.
 */
export const notificationsFeedQueryOptions = ({
  filter,
  userId,
}: {
  filter: NotificationsFeedFilter;
  userId: number;
}) =>
  infiniteQueryOptions({
    getNextPageParam: (last: NotificationsPage) => last.nextCursor,
    initialPageParam: null as null | string,
    queryFn: async ({ pageParam, signal }) =>
      await fetchNotificationsPage({
        cursor: pageParam ?? undefined,
        limit: NOTIFICATIONS_FEED_PAGE_SIZE,
        signal,
        type: filter === "mentions" ? MENTION_NOTIFICATION_TYPE : undefined,
        unread: filter === "unread",
      }),
    queryKey: [...notificationsListRoot(userId), "feed", filter] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

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

export const fetchNotificationState = async () => {
  const response = await fetcher({
    plugin: manifest.id,
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
  defaultEmail: NotificationEmailMode;
  description: null | string;
  emailModes: NotificationEmailMode[];
  id: string;
  inAppAvailable: boolean;
  label: string;
  locked: boolean;
  mandatory: boolean;
  pluginId: string;
  pushAvailable: boolean;
  value: {
    email: NotificationEmailMode;
    inApp: boolean;
    push: boolean;
  };
}

export interface NotificationPreferencesView {
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
        plugin: manifest.id,
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
