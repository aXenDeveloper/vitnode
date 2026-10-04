import type { Context } from "hono";

import { inArray } from "drizzle-orm";

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

/** A database handle or a transaction - anything that can run a query. */
export type NotificationsDb = Omit<EnvVitNode["Variables"]["db"], "$client">;

export type NotificationsContext = Context<EnvVitNode>;

export const NOTIFICATIONS_PLUGIN_ID = "@vitnode/core";
export const QUEUE_NOTIFICATIONS_FANOUT = "notifications-fanout";
export const QUEUE_NOTIFICATIONS_EMAIL = "notifications-email";
export const QUEUE_NOTIFICATIONS_CLEANUP = "notifications-cleanup";

export const GLOBAL_SETTINGS_KEY = "global";
export const typeSettingsKey = (type: string): string => `type:${type}`;

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

const clampInt = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) =>
  typeof value === "number" && Number.isInteger(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

export const normalizeGlobalSettings = (
  value: Record<string, unknown> | undefined,
): NotificationGlobalSettings => {
  const defaults = DEFAULT_NOTIFICATION_SETTINGS;

  return {
    digestHour: clampInt(value?.digestHour, 0, 23, defaults.digestHour),
    digestWeekday: clampInt(value?.digestWeekday, 0, 6, defaults.digestWeekday),
    emailCapPerHour: clampInt(
      value?.emailCapPerHour,
      0,
      500,
      defaults.emailCapPerHour,
    ),
    emailEnabled:
      typeof value?.emailEnabled === "boolean"
        ? value.emailEnabled
        : defaults.emailEnabled,
    paused: typeof value?.paused === "boolean" ? value.paused : defaults.paused,
  };
};

/** One query: the global settings and every type policy. */
export const loadNotificationSettings = async (
  db: NotificationsDb,
): Promise<NotificationSettingsSnapshot> => {
  const rows = await db.select().from(core_notification_settings);
  const policies = new Map<string, NotificationTypePolicy>();
  let global: Record<string, unknown> | undefined;

  for (const row of rows) {
    if (row.key === GLOBAL_SETTINGS_KEY) global = row.value;
    else if (row.key.startsWith("type:")) {
      policies.set(row.key.slice(5), row.value);
    }
  }

  return { global: normalizeGlobalSettings(global), policies };
};

export const getNotificationWorkers = (
  c: NotificationsContext,
): NotificationWorkerSettings =>
  c.get("core").notificationWorkers ?? resolveNotificationWorkerSettings();

/** Whether notification emails can be sent at all on this installation. */
export const isEmailConfigured = (
  c: NotificationsContext,
  settings: NotificationSettingsSnapshot,
): boolean => !!c.get("core").email?.adapter && settings.global.emailEnabled;

/**
 * Sends each user their committed unread state. Call only after the
 * transaction that produced `states` has committed.
 */
export const sendNotificationStates = (
  c: NotificationsContext,
  states: Iterable<NotificationStateMessage & { userId: number }>,
): void => {
  const realtime = c.get("realtime");
  for (const { userId, ...message } of states) {
    realtime.sendToUser(userId, notificationsStateChannel, message);
  }
};

export const loadSettingsForKeys = async (
  db: NotificationsDb,
  keys: string[],
) =>
  keys.length === 0
    ? []
    : await db
        .select()
        .from(core_notification_settings)
        .where(inArray(core_notification_settings.key, keys));
