import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import type { NotificationEmailMode } from "@/lib/notifications/types";

import { CONFIG_PLUGIN } from "@/config";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

import type { NotificationDeliveryStatus } from "./statuses";

export type NotificationDeliveryMode =
  "daily" | "immediate" | "test" | "weekly";

export interface AdminNotificationSettings {
  emailBatchSize: number;
  emailConcurrency: number;
  emailEnabled: boolean;
  fanoutBatchSize: number;
  retentionDays: number;
}

export interface AdminNotificationTypePolicy {
  allowEmail: boolean;
  email: NotificationEmailMode | null;
  enabled: boolean;
  inApp: boolean | null;
}

export interface AdminNotificationType {
  category: string;
  defaults: { email: NotificationEmailMode; inApp: boolean };
  emailAvailable: boolean;
  emailSupported: boolean;
  grouped: boolean;
  id: string;
  label: string;
  mandatory: boolean;
  pluginId: string;
  policy: AdminNotificationTypePolicy;
  version: number;
}

export interface AdminNotificationsOverview {
  email: { adapterConfigured: boolean; enabled: boolean };
  health: {
    cronActive: boolean;
    cronStale: boolean;
    deliveries: Record<string, number>;
    events: Record<string, number>;
    oldestPendingEventAt: Date | null | string;
    queue: Record<string, number>;
  };
  settings: AdminNotificationSettings;
  types: AdminNotificationType[];
}

export interface AdminNotificationDelivery {
  attempts: number;
  availableAt: Date | string;
  createdAt: Date | string;
  id: number;
  itemCount: number;
  lastError: null | string;
  maxAttempts: number;
  mode: NotificationDeliveryMode;
  providerMessageId: null | string;
  sentAt: Date | null | string;
  skipReason: null | string;
  status: NotificationDeliveryStatus;
  type: null | string;
  updatedAt: Date | string;
  userId: number;
}

export interface AdminNotificationDeliveriesPage {
  items: AdminNotificationDelivery[];
  nextCursor: null | number;
}

export const DELIVERIES_PAGE_SIZE = 25;

export const fetchNotificationsOverview =
  async (): Promise<AdminNotificationsOverview> => {
    const response = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "admin/notifications",
      path: "/overview",
    });

    if (!response.ok) {
      throw new AdminRequestError(
        response.status,
        "the notifications overview",
      );
    }

    return await response.json();
  };

export const fetchNotificationDeliveries = async ({
  cursor,
  signal,
  status,
}: {
  cursor: null | number;
  signal?: AbortSignal;
  status?: NotificationDeliveryStatus;
}): Promise<AdminNotificationDeliveriesPage> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: {
      query: {
        cursor: cursor ?? undefined,
        limit: DELIVERIES_PAGE_SIZE,
        status,
      },
    },
    method: "get",
    module: "admin/notifications",
    options: { signal },
    path: "/deliveries",
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the notification deliveries",
      status ? `status=${status}` : undefined,
    );
  }

  return await response.json();
};

/** The root every cache entry of the notifications screen hangs off. */
export const notificationsAdminQueryRoot = adminQueryRoot("notifications");

export const notificationsOverviewQueryKey = [
  ...notificationsAdminQueryRoot,
  "overview",
] as const;

export const notificationDeliveriesQueryRoot = [
  ...notificationsAdminQueryRoot,
  "deliveries",
] as const;

export const notificationsOverviewQueryOptions = () =>
  queryOptions({
    queryFn: async () => await fetchNotificationsOverview(),
    queryKey: notificationsOverviewQueryKey,
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - Health counts move while nobody touches anything. */
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const notificationDeliveriesQueryOptions = ({
  status,
}: {
  status?: NotificationDeliveryStatus;
}) =>
  infiniteQueryOptions({
    getNextPageParam: (page: AdminNotificationDeliveriesPage) =>
      page.nextCursor ?? undefined,
    initialPageParam: null as null | number,
    queryFn: async ({ pageParam, signal }) =>
      await fetchNotificationDeliveries({ cursor: pageParam, signal, status }),
    queryKey: [...notificationDeliveriesQueryRoot, status ?? "all"] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });
