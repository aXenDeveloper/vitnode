import type { NotificationEmailMode } from "@/lib/notifications/types";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

import type {
  AdminNotificationEditableSettings,
  AdminNotificationSettings,
} from "./notifications-query";

/** What every write on this screen resolves to - never a throw. */
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

/** The writes the screen can perform, as the host hands them in. */
export interface NotificationsAdminActions {
  cancelQueuedEmails: () => Promise<
    NotificationsMutationResult<{ cancelled: number }>
  >;
  cleanup: () => Promise<NotificationsMutationResult<{ success: boolean }>>;
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
  updateSettings: (
    body: Partial<AdminNotificationEditableSettings>,
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

const options = { credentials: "include" } as const;

// Each call catches: the client throws on a 500 with the server's own text,
// which the server has already logged. The screen only needs to know it failed.
export const notificationsAdminActionsInBrowser: NotificationsAdminActions = {
  cancelQueuedEmails: async () => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/notifications",
        options,
        path: "/emails/cancel",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
  cleanup: async () => {
    try {
      const response = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "post",
        module: "admin/notifications",
        options,
        path: "/cleanup",
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
        options,
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
        options,
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
        options,
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
        options,
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
        options,
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
        options,
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
        options,
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
        options,
        path: "/types/{type}",
      });
      if (!response.ok) return await failure(response);

      return { data: await response.json() };
    } catch {
      return FAILED;
    }
  },
};
