import type { NotificationTypePreference } from "@/database/notifications";
import type { NotificationEmailMode } from "@/lib/notifications/types";

import type { AnyNotificationTypeDefinition } from "./registry";

export interface NotificationTypePolicy {
  allowEmail?: boolean;
  allowInApp?: boolean;
  allowPush?: boolean;
  email?: NotificationEmailMode;
  enabled?: boolean;
  inApp?: boolean;
  memberCanEdit?: boolean;
}

export interface NotificationGlobalSettings {
  paused: boolean;
}

export const NOTIFICATION_DIGEST_SCHEDULE = { hour: 8, weekday: 1 } as const;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationGlobalSettings = {
  paused: false,
};

export interface NotificationWorkerSettings {
  emailBatchSize: number;
  emailConcurrency: number;
  fanoutBatchSize: number;
  retentionDays: number;
}

const NOTIFICATION_WORKER_LIMITS = {
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
  push: boolean;
}

const OFF: NotificationChannels = { email: "none", inApp: false, push: false };

export const isNotificationInAppAvailable = ({
  definition,
  policy,
}: {
  definition: AnyNotificationTypeDefinition;
  policy?: NotificationTypePolicy;
}): boolean => !!definition.mandatory || policy?.allowInApp !== false;

export const isNotificationPushAvailable = (
  policy?: NotificationTypePolicy,
): boolean => policy?.allowPush !== false;

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
  emailConfigured: boolean;
  policy?: NotificationTypePolicy;
}): boolean =>
  emailConfigured && !!definition.email && policy?.allowEmail !== false;

export const resolveNotificationChannels = ({
  definition,
  emailConfigured,
  policy,
  preference,
}: {
  definition: AnyNotificationTypeDefinition;
  emailConfigured: boolean;
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

  const pushAvailable = isNotificationPushAvailable(policy);

  if (definition.mandatory) {
    return {
      email: emailAvailable ? defaultEmail : "none",
      inApp: true,
      push: pushAvailable,
    };
  }

  const choice = isNotificationLockedForMembers({ definition, policy })
    ? undefined
    : preference;

  return {
    email: emailAvailable ? (choice?.email ?? defaultEmail) : "none",
    inApp:
      isNotificationInAppAvailable({ definition, policy }) &&
      (choice?.inApp ?? policy?.inApp ?? definition.defaults.inApp),
    push: pushAvailable && (choice?.push ?? true),
  };
};
