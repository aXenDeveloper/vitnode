import type { NotificationTypePreference } from "@/database/notifications";
import type { NotificationEmailMode } from "@/lib/notifications/types";

import type { AnyNotificationTypeDefinition } from "./registry";

/** Installation-wide policy for one type, edited in the AdminCP. */
export interface NotificationTypePolicy {
  /** `false` keeps the type off email whatever users choose. */
  allowEmail?: boolean;
  /** Default email mode for users who never chose one. */
  email?: NotificationEmailMode;
  /** `false` stops the type entirely (mandatory types ignore it). */
  enabled?: boolean;
  /** Default in-app setting for users who never chose one. */
  inApp?: boolean;
}

export interface NotificationGlobalSettings {
  /** Upper bound on emails one drain run sends. */
  emailBatchSize: number;
  /** Emails sent in parallel within one drain run. */
  emailConcurrency: number;
  /** Master switch for notification email - account email is unaffected. */
  emailEnabled: boolean;
  /** Recipients handled per fan-out transaction. */
  fanoutBatchSize: number;
  /** Inbox items older than this many days are removed by cleanup. */
  retentionDays: number;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationGlobalSettings = {
  emailBatchSize: 50,
  emailConcurrency: 4,
  emailEnabled: true,
  fanoutBatchSize: 500,
  retentionDays: 90,
};

export interface NotificationChannels {
  email: NotificationEmailMode;
  inApp: boolean;
}

const OFF: NotificationChannels = { email: "none", inApp: false };

/** Whether this type can email at all on this installation. */
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
 * 4. The user's own choice for the type.
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

  return {
    email: emailAvailable ? (preference?.email ?? defaultEmail) : "none",
    inApp: preference?.inApp ?? policy?.inApp ?? definition.defaults.inApp,
  };
};
