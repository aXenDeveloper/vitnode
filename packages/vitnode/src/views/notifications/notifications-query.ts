import type { NotificationEmailMode } from "@vitnode/api/lib/notifications/types";

import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import { DEFAULT_TABLE_PAGE_SIZE } from "@/components/table/url-state";
import {
  OPERATIONAL_STALE_TIME,
  RECORD_STALE_TIME,
} from "@/lib/query-freshness";
import { readFirstValue, readPageSize } from "@/lib/table-params";
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
  limit,
  signal,
}: {
  limit: number;
  signal?: AbortSignal;
}): Promise<NotificationsPage> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: { limit } },
    method: "get",
    module: "notifications",
    options: { signal },
    path: "/",
  });
  if (!response.ok) throw new NotificationsRequestError(response.status);

  return await response.json();
};

const NOTIFICATIONS_RECENT_SIZE = 8;
const NOTIFICATIONS_MAX_PAGE_SIZE = 50;

export const NOTIFICATIONS_TABLE_ORDER_BY = [
  "lastActivityAt",
  "category",
] as const;
export type NotificationsTableOrderBy =
  (typeof NOTIFICATIONS_TABLE_ORDER_BY)[number];

export const NOTIFICATIONS_TABLE_STATUSES = ["unread", "read"] as const;
export type NotificationsTableStatus =
  (typeof NOTIFICATIONS_TABLE_STATUSES)[number];

const CATEGORY = /^[a-z0-9_-]{1,50}$/;

/** The notifications table's request, as the `/inbox` route reads it. */
export interface NotificationsTableParams {
  category?: string;
  first?: string;
  order?: "asc" | "desc";
  orderBy?: NotificationsTableOrderBy;
  page?: string;
  status?: NotificationsTableStatus;
}

export type RawNotificationsTableParams = Partial<
  Record<keyof NotificationsTableParams, null | string | string[] | undefined>
>;

/** Keeps only the table params the route accepts; page 1 and unknown values are dropped. */
export const normalizeNotificationsTableParams = (
  raw: RawNotificationsTableParams = {},
): NotificationsTableParams => {
  const params: NotificationsTableParams = {};

  const page = readFirstValue(raw.page);
  if (/^[1-9]\d{0,8}$/.test(page) && page !== "1") params.page = page;

  params.first =
    readPageSize(readFirstValue(raw.first), NOTIFICATIONS_MAX_PAGE_SIZE) ??
    String(DEFAULT_TABLE_PAGE_SIZE);

  const orderBy = readFirstValue(raw.orderBy) as NotificationsTableOrderBy;
  if (NOTIFICATIONS_TABLE_ORDER_BY.includes(orderBy)) params.orderBy = orderBy;

  const order = readFirstValue(raw.order);
  if (order === "asc" || order === "desc") params.order = order;

  const status = readFirstValue(raw.status) as NotificationsTableStatus;
  if (NOTIFICATIONS_TABLE_STATUSES.includes(status)) params.status = status;

  const categories = [
    ...new Set(
      readFirstValue(raw.category)
        .split(",")
        .filter(value => CATEGORY.test(value)),
    ),
  ];
  if (categories.length > 0) params.category = categories.join(",");

  return params;
};

export interface NotificationsTablePage {
  edges: NotificationItemView[];
  pageInfo: {
    count: number;
    currentPage: null | number;
    endCursor: null | string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    pageSize: number;
    startCursor: null | string;
    totalCount: number;
    totalPages: number;
  };
}

export const fetchNotificationsTablePage = async (
  params: NotificationsTableParams,
  { signal }: { signal?: AbortSignal } = {},
): Promise<NotificationsTablePage> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: params },
    method: "get",
    module: "notifications",
    options: { signal },
    path: "/inbox",
  });
  if (!response.ok) throw new NotificationsRequestError(response.status);

  return await response.json();
};

export const notificationsTableQueryOptions = ({
  params,
  userId,
}: {
  params: NotificationsTableParams;
  userId: number;
}) =>
  queryOptions({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) =>
      await fetchNotificationsTablePage(params, { signal }),
    queryKey: [...notificationsListRoot(userId), "table", params] as const,
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
