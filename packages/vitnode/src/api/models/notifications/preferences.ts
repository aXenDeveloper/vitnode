import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { NotificationTypePreference } from "@/database/notifications";
import type { NotificationEmailMode } from "@/lib/notifications/types";

import { isValidTimeZone } from "@/api/lib/notifications/digest-period";
import {
  isNotificationEmailAvailable,
  resolveNotificationChannels,
} from "@/api/lib/notifications/preferences";
import { core_notification_user_state } from "@/database/notifications";

import type { NotificationsContext } from "./shared";

import { lockUserStates } from "./fanout";
import { createTranslatorCache } from "./render";
import {
  getNotificationRegistry,
  isEmailConfigured,
  loadNotificationSettings,
} from "./shared";

export interface NotificationTypePreferenceView {
  category: string;
  categoryLabel: string;
  description: null | string;
  /** The modes this type may use here - empty when email is unavailable. */
  emailModes: NotificationEmailMode[];
  id: string;
  label: string;
  mandatory: boolean;
  pluginId: string;
  /** What the user gets now, after defaults and installation policy. */
  value: { email: NotificationEmailMode; inApp: boolean };
}

export interface NotificationPreferencesView {
  digestHour: number;
  digestWeekday: number;
  timeZone: null | string;
  types: NotificationTypePreferenceView[];
}

const translateOr = (
  t: Awaited<ReturnType<ReturnType<typeof createTranslatorCache>>>["t"],
  keys: string[],
  fallback: string,
): string => {
  for (const key of keys) {
    if (t.has(key)) return t(key);
  }

  return fallback;
};

/**
 * One row per registered type the installation has not switched off, in the
 * user's language. Rows are generated from the definitions, never stored: a
 * new plugin's types appear without a migration.
 */
export const getNotificationPreferences = async (
  c: NotificationsContext,
  { language, userId }: { language?: string; userId: number },
): Promise<NotificationPreferencesView> => {
  const db = c.get("db");
  const [settings, [state]] = await Promise.all([
    loadNotificationSettings(db),
    db
      .select()
      .from(core_notification_user_state)
      .where(eq(core_notification_user_state.userId, userId))
      .limit(1),
  ]);
  const { t } = await createTranslatorCache(c)(language);
  const emailConfigured = isEmailConfigured(c, settings);
  const preferences = state?.preferences ?? {};

  const types = getNotificationRegistry(c)
    .list.filter(({ definition }) => {
      const policy = settings.policies.get(definition.id);

      return policy?.enabled !== false || definition.mandatory;
    })
    .map(({ definition, pluginId }): NotificationTypePreferenceView => {
      const policy = settings.policies.get(definition.id);
      const emailAvailable =
        isNotificationEmailAvailable({ definition, emailConfigured, policy }) &&
        !definition.mandatory;

      return {
        category: definition.category,
        categoryLabel: translateOr(
          t,
          [
            `core.notifications.categories.${definition.category}`,
            `${pluginId}.notifications.categories.${definition.category}`,
          ],
          definition.category,
        ),
        description: definition.description
          ? translateOr(t, [definition.description], definition.description)
          : null,
        emailModes: emailAvailable
          ? ["none", "immediate", "daily", "weekly"]
          : [],
        id: definition.id,
        label: translateOr(t, [definition.label], definition.id),
        mandatory: !!definition.mandatory,
        pluginId,
        value: resolveNotificationChannels({
          definition,
          emailConfigured,
          muted: false,
          policy,
          preference: preferences[definition.id],
        }),
      };
    });

  return {
    digestHour: state?.digestHour ?? 8,
    digestWeekday: state?.digestWeekday ?? 1,
    timeZone: state?.timeZone ?? null,
    types,
  };
};

export interface UpdateNotificationPreferencesArgs {
  digestHour?: number;
  digestWeekday?: number;
  timeZone?: null | string;
  types?: Record<string, NotificationTypePreference>;
}

/**
 * Saves the user's choices, refusing anything the installation does not
 * offer: unknown types, email for a type without email, and changes to
 * mandatory types.
 */
export const updateNotificationPreferences = async (
  c: NotificationsContext,
  userId: number,
  args: UpdateNotificationPreferencesArgs,
): Promise<void> => {
  const registry = getNotificationRegistry(c);
  const db = c.get("db");
  const settings = await loadNotificationSettings(db);
  const emailConfigured = isEmailConfigured(c, settings);

  if (args.timeZone && !isValidTimeZone(args.timeZone)) {
    throw new HTTPException(400, { message: "Unknown time zone." });
  }

  const patch: Record<string, NotificationTypePreference> = {};
  for (const [typeId, preference] of Object.entries(args.types ?? {})) {
    const registered = registry.get(typeId);
    if (!registered) {
      throw new HTTPException(400, {
        message: `Unknown notification type "${typeId}".`,
      });
    }
    const { definition } = registered;
    if (definition.mandatory) {
      throw new HTTPException(400, {
        message: `"${typeId}" cannot be changed.`,
      });
    }
    if (
      preference.email !== undefined &&
      preference.email !== "none" &&
      !isNotificationEmailAvailable({
        definition,
        emailConfigured,
        policy: settings.policies.get(typeId),
      })
    ) {
      throw new HTTPException(400, {
        message: `"${typeId}" has no email channel.`,
      });
    }
    patch[typeId] = {
      ...(preference.email === undefined ? {} : { email: preference.email }),
      ...(preference.inApp === undefined ? {} : { inApp: preference.inApp }),
    };
  }

  await db.transaction(async tx => {
    const [current] = await lockUserStates(tx, [userId]);
    const merged = { ...current?.preferences };
    for (const [typeId, preference] of Object.entries(patch)) {
      merged[typeId] = { ...merged[typeId], ...preference };
    }

    await tx
      .update(core_notification_user_state)
      .set({
        preferences: sql`${JSON.stringify(merged)}::jsonb`,
        updatedAt: new Date(),
        ...(args.timeZone === undefined ? {} : { timeZone: args.timeZone }),
        ...(args.digestHour === undefined
          ? {}
          : { digestHour: args.digestHour }),
        ...(args.digestWeekday === undefined
          ? {}
          : { digestWeekday: args.digestWeekday }),
      })
      .where(eq(core_notification_user_state.userId, userId));
  });
};
