import type { Context } from "hono";

import type {
  NotificationGlobalSettings,
  NotificationTypePolicy,
} from "@/api/lib/notifications/preferences";
import type { NotificationRegistry } from "@/api/lib/notifications/registry";
import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { NotificationStateMessage } from "@/lib/notifications/types";

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationWorkerSettings,
  resolveNotificationWorkerSettings,
} from "@/api/lib/notifications/preferences";
import { core_notification_settings } from "@/database/notifications";
import { notificationsStateChannel } from "@/ws/notifications";

export type NotificationsDb = Omit<EnvVitNode["Variables"]["db"], "$client">;

export type NotificationsContext = Context<EnvVitNode>;

export const NOTIFICATIONS_PLUGIN_ID = "@vitnode/core";
export const QUEUE_NOTIFICATIONS_FANOUT = "notifications-fanout";
export const QUEUE_NOTIFICATIONS_EMAIL = "notifications-email";
export const QUEUE_NOTIFICATIONS_CLEANUP = "notifications-cleanup";

export const GLOBAL_SETTINGS_KEY = "global";
const TYPE_SETTINGS_KEY_PREFIX = "type:";
export const typeSettingsKey = (type: string): string =>
  `${TYPE_SETTINGS_KEY_PREFIX}${type}`;

export const getNotificationRegistry = (
  c: NotificationsContext,
): NotificationRegistry => {
  const registry = c.get("core").notifications;
  if (!registry) throw new Error("[Notifications] Registry not initialized.");

  return registry;
};

export interface NotificationSettingsSnapshot {
  global: NotificationGlobalSettings;
  policies: Map<string, NotificationTypePolicy>;
}

const normalizeGlobalSettings = (
  value: Record<string, unknown> | undefined,
): NotificationGlobalSettings => ({
  paused:
    typeof value?.paused === "boolean"
      ? value.paused
      : DEFAULT_NOTIFICATION_SETTINGS.paused,
});

export const loadNotificationSettings = async (
  db: NotificationsDb,
): Promise<NotificationSettingsSnapshot> => {
  const rows = await db.select().from(core_notification_settings);
  const policies = new Map<string, NotificationTypePolicy>();
  let global: Record<string, unknown> | undefined;

  for (const row of rows) {
    if (row.key === GLOBAL_SETTINGS_KEY) global = row.value;
    else if (row.key.startsWith(TYPE_SETTINGS_KEY_PREFIX)) {
      policies.set(row.key.slice(TYPE_SETTINGS_KEY_PREFIX.length), row.value);
    }
  }

  return { global: normalizeGlobalSettings(global), policies };
};

export const getNotificationWorkers = (
  c: NotificationsContext,
): NotificationWorkerSettings =>
  c.get("core").notificationWorkers ?? resolveNotificationWorkerSettings();

export const isEmailConfigured = (c: NotificationsContext): boolean =>
  !!c.get("core").email?.adapter;

export const sendNotificationStates = (
  c: NotificationsContext,
  states: Iterable<NotificationStateMessage & { userId: number }>,
): void => {
  const realtime = c.get("realtime");
  for (const { userId, ...message } of states) {
    realtime.sendToUser(userId, notificationsStateChannel, message);
  }
};
