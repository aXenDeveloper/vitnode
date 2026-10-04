import type { NotificationEmailMode } from "@/lib/notifications/types";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

export type NotificationsMutationResult<T> =
  | { data: T; error?: never; status?: never }
  | { data?: never; error: string; status: number };

export interface NotificationTypePolicyPatch {
  allowEmail?: boolean;
  allowInApp?: boolean;
  allowPush?: boolean;
  email?: NotificationEmailMode;
  enabled?: boolean;
  inApp?: boolean;
  memberCanEdit?: boolean;
}

export interface NotificationsAdminActions {
  cancelQueuedEmails: () => Promise<
    NotificationsMutationResult<{ cancelled: number }>
  >;
  deleteAll: () => Promise<
    NotificationsMutationResult<{ events: number; items: number }>
  >;
  markEverythingRead: () => Promise<
    NotificationsMutationResult<{ items: number; members: number }>
  >;
  pause: () => Promise<NotificationsMutationResult<{ success: boolean }>>;
  resetMemberPreferences: () => Promise<
    NotificationsMutationResult<{ members: number }>
  >;
  resume: () => Promise<
    NotificationsMutationResult<{ requeuedEvents: number }>
  >;
  sendTestEmail: () => Promise<
    NotificationsMutationResult<{ deliveryId: number }>
  >;
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

export const notificationsAdminActionsInBrowser: NotificationsAdminActions = {
  cancelQueuedEmails: async () => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/notifications",
        path: "/emails/cancel",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  deleteAll: async () => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/notifications",
        path: "/delete-all",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  markEverythingRead: async () => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/notifications",
        path: "/read-all",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  pause: async () => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/notifications",
        path: "/pause",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  resetMemberPreferences: async () => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/notifications",
        path: "/members/reset-preferences",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  resume: async () => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/notifications",
        path: "/resume",
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
        path: "/test-email",
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
        path: "/types/{type}",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
};
