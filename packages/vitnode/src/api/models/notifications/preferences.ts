import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { NotificationTypePreference } from "@/database/notifications";
import type { NotificationEmailMode } from "@/lib/notifications/types";

import {
  isNotificationEmailAvailable,
  isNotificationInAppAvailable,
  isNotificationLockedForMembers,
  isNotificationPushAvailable,
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
  defaultEmail: NotificationEmailMode;
  description: null | string;
  emailModes: NotificationEmailMode[];
  id: string;
  inAppAvailable: boolean;
  label: string;
  locked: boolean;
  mandatory: boolean;
  pluginId: string;
  pushAvailable: boolean;
  value: { email: NotificationEmailMode; inApp: boolean; push: boolean };
}

export interface NotificationPreferencesView {
  types: NotificationTypePreferenceView[];
}

export const translateOr = (
  t: Awaited<ReturnType<ReturnType<typeof createTranslatorCache>>>["t"],
  keys: string[],
  fallback: string,
): string => {
  for (const key of keys) {
    if (t.has(key)) return t(key);
  }

  return fallback;
};

export const getNotificationPreferences = async (
  c: NotificationsContext,
  { language, userId }: { language?: string; userId: number },
): Promise<NotificationPreferencesView> => {
  const db = c.get("db");
  const [settings, [state], { t }] = await Promise.all([
    loadNotificationSettings(db),
    db
      .select()
      .from(core_notification_user_state)
      .where(eq(core_notification_user_state.userId, userId))
      .limit(1),
    createTranslatorCache(c)(language),
  ]);
  const emailConfigured = isEmailConfigured(c);
  const preferences = state?.preferences ?? {};

  const types = getNotificationRegistry(c)
    .list.filter(({ definition }) => {
      const policy = settings.policies.get(definition.id);
      if (definition.mandatory) return true;

      return (
        policy?.enabled !== false &&
        (isNotificationInAppAvailable({ definition, policy }) ||
          isNotificationEmailAvailable({ definition, emailConfigured, policy }))
      );
    })
    .map(({ definition, pluginId }): NotificationTypePreferenceView => {
      const policy = settings.policies.get(definition.id);
      const locked = isNotificationLockedForMembers({ definition, policy });
      const emailAvailable =
        isNotificationEmailAvailable({ definition, emailConfigured, policy }) &&
        !locked;

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
        defaultEmail: resolveNotificationChannels({
          definition,
          emailConfigured,
          policy,
        }).email,
        description: definition.description
          ? translateOr(t, [definition.description], definition.description)
          : null,
        emailModes: emailAvailable
          ? ["none", "immediate", "daily", "weekly"]
          : [],
        id: definition.id,
        inAppAvailable: isNotificationInAppAvailable({ definition, policy }),
        label: translateOr(t, [definition.label], definition.id),
        locked,
        mandatory: !!definition.mandatory,
        pluginId,
        pushAvailable: isNotificationPushAvailable(policy),
        value: resolveNotificationChannels({
          definition,
          emailConfigured,
          policy,
          preference: preferences[definition.id],
        }),
      };
    });

  return {
    types,
  };
};

export interface UpdateNotificationPreferencesArgs {
  types?: Record<string, NotificationTypePreference>;
}

export const updateNotificationPreferences = async (
  c: NotificationsContext,
  userId: number,
  args: UpdateNotificationPreferencesArgs,
): Promise<void> => {
  const registry = getNotificationRegistry(c);
  const db = c.get("db");
  const settings = await loadNotificationSettings(db);
  const emailConfigured = isEmailConfigured(c);

  const patch: Record<string, NotificationTypePreference> = {};
  for (const [typeId, preference] of Object.entries(args.types ?? {})) {
    const registered = registry.get(typeId);
    if (!registered) {
      throw new HTTPException(400, {
        message: `Unknown notification type "${typeId}".`,
      });
    }
    const { definition } = registered;
    const policy = settings.policies.get(typeId);
    if (isNotificationLockedForMembers({ definition, policy })) {
      throw new HTTPException(400, {
        message: `"${typeId}" cannot be changed.`,
      });
    }
    if (
      preference.inApp === true &&
      !isNotificationInAppAvailable({ definition, policy })
    ) {
      throw new HTTPException(400, {
        message: `"${typeId}" is not shown in the notification list.`,
      });
    }
    if (
      preference.email !== undefined &&
      preference.email !== "none" &&
      !isNotificationEmailAvailable({ definition, emailConfigured, policy })
    ) {
      throw new HTTPException(400, {
        message: `"${typeId}" has no email channel.`,
      });
    }
    if (preference.push === true && !isNotificationPushAvailable(policy)) {
      throw new HTTPException(400, {
        message: `"${typeId}" is not sent as push.`,
      });
    }
    patch[typeId] = {
      ...(preference.email === undefined ? {} : { email: preference.email }),
      ...(preference.inApp === undefined ? {} : { inApp: preference.inApp }),
      ...(preference.push === undefined ? {} : { push: preference.push }),
    };
  }

  await db.transaction(async tx => {
    const [current] = await lockUserStates(tx, [userId]);
    const merged = { ...current.preferences };
    for (const [typeId, preference] of Object.entries(patch)) {
      merged[typeId] = { ...merged[typeId], ...preference };
    }

    await tx
      .update(core_notification_user_state)
      .set({
        preferences: sql`${JSON.stringify(merged)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(core_notification_user_state.userId, userId));
  });
};
