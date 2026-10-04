import { queryOptions } from "@tanstack/react-query";

import type { NotificationEmailMode } from "@/lib/notifications/types";

import { CONFIG_PLUGIN } from "@/config";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

export interface AdminNotificationSettings {
  digestHour: number;
  digestWeekday: number;
  emailCapPerHour: number;
  emailEnabled: boolean;
  paused: boolean;
}

export interface AdminNotificationWorkers {
  emailBatchSize: number;
  emailConcurrency: number;
  fanoutBatchSize: number;
  retentionDays: number;
}

export type AdminNotificationEditableSettings = Omit<
  AdminNotificationSettings,
  "paused"
>;

export interface AdminNotificationTypePolicy {
  allowEmail: boolean;
  allowInApp: boolean;
  allowPush: boolean;
  email: NotificationEmailMode | null;
  enabled: boolean;
  inApp: boolean | null;
  memberCanEdit: boolean;
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
  counts: {
    customizedMembers: number;
    inboxItems: number;
    queuedEmails: number;
    unreadItems: number;
  };
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
  workers: AdminNotificationWorkers;
}

export const NOTIFICATION_STATS_RANGES = ["24h", "7d", "30d"] as const;
export type NotificationStatsRange = (typeof NOTIFICATION_STATS_RANGES)[number];

export interface NotificationStatsTotals {
  events: number;
  failed: number;
  sent: number;
  skipped: number;
}

export interface AdminNotificationStats {
  points: (NotificationStatsTotals & { key: string })[];
  previous: NotificationStatsTotals;
  range: NotificationStatsRange;
  timeZone: string;
  totals: NotificationStatsTotals;
  unit: "day" | "hour";
}

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

export const fetchNotificationStats = async ({
  range,
  timeZone,
}: {
  range: NotificationStatsRange;
  timeZone: string;
}): Promise<AdminNotificationStats> => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { query: { range, timeZone } },
    method: "get",
    module: "admin/notifications",
    path: "/stats",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the notification activity");
  }

  return await response.json();
};

/** The root every cache entry of the notifications screen hangs off. */
export const notificationsAdminQueryRoot = adminQueryRoot("notifications");

export const notificationsOverviewQueryKey = [
  ...notificationsAdminQueryRoot,
  "overview",
] as const;

export const notificationStatsQueryRoot = [
  ...notificationsAdminQueryRoot,
  "stats",
] as const;

export const notificationsOverviewQueryOptions = () =>
  queryOptions({
    queryFn: async () => await fetchNotificationsOverview(),
    queryKey: notificationsOverviewQueryKey,
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - Health counts move while nobody touches anything. */
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const notificationStatsQueryOptions = ({
  range,
  timeZone,
}: {
  range: NotificationStatsRange;
  timeZone: string;
}) =>
  queryOptions({
    queryFn: async () => await fetchNotificationStats({ range, timeZone }),
    queryKey: [...notificationStatsQueryRoot, range, timeZone] as const,
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });
