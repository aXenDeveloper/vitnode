import type { NotificationEmailMode } from "@/lib/notifications/types";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

import type { AdminNotificationSettings } from "./notifications-query";

/** What every write on this screen resolves to - never a throw. */
export type NotificationsMutationResult<T> =
  | { data: T; error?: never; status?: never }
  | { data?: never; error: string; status: number };

export interface NotificationTypePolicyPatch {
  allowEmail?: boolean;
  email?: NotificationEmailMode;
  enabled?: boolean;
  inApp?: boolean;
}

/** The writes the screen can perform, as the host hands them in. */
export interface NotificationsAdminActions {
  cleanup: () => Promise<NotificationsMutationResult<{ success: boolean }>>;
  reconcile: (body: {
    dryRun: boolean;
  }) => Promise<
    NotificationsMutationResult<{ corrected: number; mismatched: number }>
  >;
  retryDelivery: (
    id: number,
  ) => Promise<NotificationsMutationResult<{ success: boolean }>>;
  sendTestEmail: () => Promise<
    NotificationsMutationResult<{ deliveryId: number }>
  >;
  updateSettings: (
    body: Partial<AdminNotificationSettings>,
  ) => Promise<NotificationsMutationResult<AdminNotificationSettings>>;
  updateTypePolicy: (
    type: string,
    body: NotificationTypePolicyPatch,
  ) => Promise<NotificationsMutationResult<{ success: boolean }>>;
}

const FAILED = { error: "Request failed", status: 500 } as const;

const failure = async (response: {
  status: number;
  text: () => Promise<string>;
}) => ({ error: await response.text(), status: response.status });

// Each call catches: the client throws on a 500 with the server's own text,
// which the server has already logged. The screen only needs to know it failed.
export const notificationsAdminActionsInBrowser: NotificationsAdminActions = {
  cleanup: async () => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/notifications",
        options: { credentials: "include" },
        path: "/cleanup",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  reconcile: async body => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body },
        method: "post",
        module: "admin/notifications",
        options: { credentials: "include" },
        path: "/reconcile",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  retryDelivery: async id => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { params: { id: id } },
        method: "post",
        module: "admin/notifications",
        options: { credentials: "include" },
        path: "/deliveries/{id}/retry",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  sendTestEmail: async () => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/notifications",
        options: { credentials: "include" },
        path: "/test-email",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  updateSettings: async body => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body },
        method: "put",
        module: "admin/notifications",
        options: { credentials: "include" },
        path: "/settings",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  updateTypePolicy: async (type, body) => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body, params: { type } },
        method: "put",
        module: "admin/notifications",
        options: { credentials: "include" },
        path: "/types/{type}",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
};
