import type { NotificationTypePreference } from "@/database/notifications";
import type { NotificationEmailMode } from "@/lib/notifications/types";

import type { AnyNotificationTypeDefinition } from "./registry";

/** Installation-wide policy for one type, edited in the AdminCP. */
export interface NotificationTypePolicy {
  /** `false` keeps the type off email whatever users choose. */
  allowEmail?: boolean;
  allowInApp?: boolean;
  allowPush?: boolean;
  /** Default email mode for users who never chose one. */
  email?: NotificationEmailMode;
  /** `false` stops the type entirely (mandatory types ignore it). */
  enabled?: boolean;
  /** Default in-app setting for users who never chose one. */
  inApp?: boolean;
  memberCanEdit?: boolean;
}

export interface NotificationGlobalSettings {
  digestHour: number;
  digestWeekday: number;
  emailCapPerHour: number;
  /** Master switch for notification email - account email is unaffected. */
  emailEnabled: boolean;
  paused: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationGlobalSettings = {
  digestHour: 8,
  digestWeekday: 1,
  emailCapPerHour: 0,
  emailEnabled: true,
  paused: false,
};

export interface NotificationWorkerSettings {
  /** Upper bound on emails one drain run sends. */
  emailBatchSize: number;
  /** Emails sent in parallel within one drain run. */
  emailConcurrency: number;
  /** Recipients handled per fan-out transaction. */
  fanoutBatchSize: number;
  /** Inbox items older than this many days are removed by cleanup. */
  retentionDays: number;
}

export const NOTIFICATION_WORKER_LIMITS = {
  emailBatchSize: { default: 50, max: 500, min: 1 },
  emailConcurrency: { default: 4, max: 20, min: 1 },
  fanoutBatchSize: { default: 500, max: 5000, min: 10 },
  retentionDays: { default: 90, max: 3650, min: 1 },
} as const satisfies Record<
  keyof NotificationWorkerSettings,
  { default: number; max: number; min: number }
>;

export const resolveNotificationWorkerSettings = (
  config: Partial<NotificationWorkerSettings> = {},
): NotificationWorkerSettings => {
  const resolve = (key: keyof NotificationWorkerSettings) => {
    const { default: fallback, max, min } = NOTIFICATION_WORKER_LIMITS[key];
    const value = config[key];

    return typeof value === "number" && Number.isInteger(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  };

  return {
    emailBatchSize: resolve("emailBatchSize"),
    emailConcurrency: resolve("emailConcurrency"),
    fanoutBatchSize: resolve("fanoutBatchSize"),
    retentionDays: resolve("retentionDays"),
  };
};

export interface NotificationChannels {
  email: NotificationEmailMode;
  inApp: boolean;
}

const OFF: NotificationChannels = { email: "none", inApp: false };

/** Whether this type can email at all on this installation. */
export const isNotificationInAppAvailable = ({
  definition,
  policy,
}: {
  definition: AnyNotificationTypeDefinition;
  policy?: NotificationTypePolicy;
}): boolean => !!definition.mandatory || policy?.allowInApp !== false;

export const isNotificationLockedForMembers = ({
  definition,
  policy,
}: {
  definition: AnyNotificationTypeDefinition;
  policy?: NotificationTypePolicy;
}): boolean => !!definition.mandatory || policy?.memberCanEdit === false;

export const isNotificationEmailAvailable = ({
  definition,
  emailConfigured,
  policy,
}: {
  definition: AnyNotificationTypeDefinition;
  /** An email adapter exists and notification email is switched on. */
  emailConfigured: boolean;
  policy?: NotificationTypePolicy;
}): boolean =>
  emailConfigured && !!definition.email && policy?.allowEmail !== false;

/**
 * The single place that decides what a user receives, in this order:
 *
 * 1. Installation policy disables the type → nothing (mandatory types excepted).
 * 2. Mandatory types → always in-app; email follows the installation default.
 * 3. The user muted the subject → nothing.
 * 4. The user's own choice for the type, unless the type is locked for members.
 * 5. The installation default for the type.
 * 6. The type's own default.
 *
 * Email is additionally limited to what the type and installation offer, and
 * never depends on the in-app choice.
 */
export const resolveNotificationChannels = ({
  definition,
  emailConfigured,
  muted,
  policy,
  preference,
}: {
  definition: AnyNotificationTypeDefinition;
  emailConfigured: boolean;
  muted: boolean;
  policy?: NotificationTypePolicy;
  preference?: NotificationTypePreference;
}): NotificationChannels => {
  if (policy?.enabled === false && !definition.mandatory) return OFF;

  const emailAvailable = isNotificationEmailAvailable({
    definition,
    emailConfigured,
    policy,
  });
  const defaultEmail = policy?.email ?? definition.defaults.email;

  if (definition.mandatory) {
    return { email: emailAvailable ? defaultEmail : "none", inApp: true };
  }

  if (muted) return OFF;

  const choice = isNotificationLockedForMembers({ definition, policy })
    ? undefined
    : preference;

  return {
    email: emailAvailable ? (choice?.email ?? defaultEmail) : "none",
    inApp:
      isNotificationInAppAvailable({ definition, policy }) &&
      (choice?.inApp ?? policy?.inApp ?? definition.defaults.inApp),
  };
};
