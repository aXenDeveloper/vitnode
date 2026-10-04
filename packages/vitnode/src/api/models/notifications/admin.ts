import { and, count, desc, eq, inArray, like, lt, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { NotificationTypePolicy } from "@/api/lib/notifications/preferences";

import {
  isNotificationEmailAvailable,
  isNotificationInAppAvailable,
  isNotificationLockedForMembers,
} from "@/api/lib/notifications/preferences";
import { loadCronHealth } from "@/api/modules/cron/helpers/load-cron-health";
import {
  core_notification_deliveries,
  core_notification_events,
  core_notification_settings,
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";
import { core_queue } from "@/database/queue";

import type { NotificationsContext } from "./shared";

import { dispatchEmailDrain } from "./email-queue";
import { reconcileNotificationCounts, UNREAD_SQL } from "./inbox";
import { translateOr } from "./preferences";
import { createTranslatorCache } from "./render";
import {
  getNotificationRegistry,
  getNotificationWorkers,
  isEmailConfigured,
  loadNotificationSettings,
  NOTIFICATIONS_PLUGIN_ID,
  typeSettingsKey,
} from "./shared";

const countBy = <K extends string>(rows: { count: number; key: K }[]) => {
  const counts: Partial<Record<K, number>> = {};
  for (const row of rows) counts[row.key] = row.count;

  return counts;
};

export const getNotificationsOverview = async (c: NotificationsContext) => {
  const db = c.get("db");
  const core = c.get("core");
  const emailConfigured = isEmailConfigured(c);

  const [
    settings,
    { t },
    queueRows,
    deliveryRows,
    eventRows,
    [oldestPending],
    cronHealth,
    [inbox],
    [members],
  ] = await Promise.all([
    loadNotificationSettings(db),
    createTranslatorCache(c)(c.get("admin")?.user.language),
    db
      .select({
        count: count(),
        key: sql<string>`${core_queue.name} || ':' || ${core_queue.status}`,
      })
      .from(core_queue)
      .where(
        and(
          eq(core_queue.pluginId, NOTIFICATIONS_PLUGIN_ID),
          like(core_queue.name, "notifications-%"),
        ),
      )
      .groupBy(core_queue.name, core_queue.status),
    db
      .select({ count: count(), key: core_notification_deliveries.status })
      .from(core_notification_deliveries)
      .groupBy(core_notification_deliveries.status),
    db
      .select({ count: count(), key: core_notification_events.status })
      .from(core_notification_events)
      .groupBy(core_notification_events.status),
    db
      .select({ createdAt: core_notification_events.createdAt })
      .from(core_notification_events)
      .where(
        inArray(core_notification_events.status, ["pending", "processing"]),
      )
      .orderBy(core_notification_events.createdAt)
      .limit(1),
    loadCronHealth(db),
    db
      .select({
        items: count(),
        unread: sql<number>`count(*) filter (where ${UNREAD_SQL})`.mapWith(
          Number,
        ),
      })
      .from(core_notifications),
    db
      .select({ customized: count() })
      .from(core_notification_user_state)
      .where(sql`${core_notification_user_state.preferences} <> '{}'::jsonb`),
  ]);

  return {
    counts: {
      customizedMembers: members.customized,
      inboxItems: inbox.items,
      queuedEmails: countBy(deliveryRows).pending ?? 0,
      unreadItems: inbox.unread,
    },
    email: {
      adapterConfigured: !!core.email?.adapter,
    },
    health: {
      cronActive: core.hasCronAdapter,
      cronStale: cronHealth.stale,
      deliveries: countBy(deliveryRows),
      events: countBy(eventRows),
      oldestPendingEventAt: oldestPending?.createdAt ?? null,
      queue: countBy(queueRows),
    },
    settings: settings.global,
    workers: getNotificationWorkers(c),
    types: getNotificationRegistry(c).list.map(({ definition, pluginId }) => {
      const policy = settings.policies.get(definition.id) ?? {};

      return {
        category: definition.category,
        defaults: definition.defaults,
        emailAvailable: isNotificationEmailAvailable({
          definition,
          emailConfigured,
          policy,
        }),
        emailSupported: !!definition.email,
        grouped: !!definition.grouping,
        id: definition.id,
        label: translateOr(t, [definition.label], definition.id),
        mandatory: !!definition.mandatory,
        pluginId,
        policy: {
          allowEmail: policy.allowEmail ?? true,
          allowInApp: isNotificationInAppAvailable({ definition, policy }),
          allowPush: policy.allowPush ?? true,
          email: policy.email ?? null,
          enabled: policy.enabled ?? true,
          inApp: policy.inApp ?? null,
          memberCanEdit: !isNotificationLockedForMembers({
            definition,
            policy,
          }),
        },
        version: definition.version,
      };
    }),
  };
};

export const upsertNotificationSetting = async (
  c: NotificationsContext,
  key: string,
  value: Record<string, unknown>,
) => {
  await c
    .get("db")
    .insert(core_notification_settings)
    .values({ key, updatedAt: new Date(), value })
    .onConflictDoUpdate({
      set: { updatedAt: new Date(), value },
      target: core_notification_settings.key,
    });
};

const POLICY_KEYS = [
  "allowEmail",
  "allowInApp",
  "allowPush",
  "email",
  "enabled",
  "inApp",
  "memberCanEdit",
] as const satisfies readonly (keyof NotificationTypePolicy)[];

export const updateNotificationTypePolicy = async (
  c: NotificationsContext,
  typeId: string,
  patch: NotificationTypePolicy,
): Promise<NotificationTypePolicy> => {
  const registered = getNotificationRegistry(c).get(typeId);
  if (!registered) throw new HTTPException(404);
  if (patch.email && patch.email !== "none" && !registered.definition.email) {
    throw new HTTPException(400, {
      message: "This type has no email channel.",
    });
  }

  const { policies } = await loadNotificationSettings(c.get("db"));
  const merged: NotificationTypePolicy = { ...policies.get(typeId) };
  for (const key of POLICY_KEYS) {
    if (patch[key] !== undefined) Object.assign(merged, { [key]: patch[key] });
  }

  await upsertNotificationSetting(c, typeSettingsKey(typeId), { ...merged });
  await c.get("events").emit("notifications.type.updated", { typeId });

  return merged;
};

export const listNotificationDeliveries = async (
  c: NotificationsContext,
  {
    beforeId,
    limit,
    status,
  }: {
    beforeId?: number;
    limit: number;
    status?: (typeof core_notification_deliveries.$inferSelect)["status"];
  },
) => {
  const rows = await c
    .get("db")
    .select({
      attempts: core_notification_deliveries.attempts,
      availableAt: core_notification_deliveries.availableAt,
      createdAt: core_notification_deliveries.createdAt,
      id: core_notification_deliveries.id,
      itemCount: core_notification_deliveries.itemCount,
      lastError: core_notification_deliveries.lastError,
      maxAttempts: core_notification_deliveries.maxAttempts,
      mode: core_notification_deliveries.mode,
      providerMessageId: core_notification_deliveries.providerMessageId,
      sentAt: core_notification_deliveries.sentAt,
      skipReason: core_notification_deliveries.skipReason,
      status: core_notification_deliveries.status,
      type: core_notification_events.type,
      updatedAt: core_notification_deliveries.updatedAt,
      userId: core_notification_deliveries.userId,
    })
    .from(core_notification_deliveries)
    .leftJoin(
      core_notification_events,
      eq(core_notification_events.id, core_notification_deliveries.eventId),
    )
    .where(
      and(
        status ? eq(core_notification_deliveries.status, status) : undefined,
        beforeId ? lt(core_notification_deliveries.id, beforeId) : undefined,
      ),
    )
    .orderBy(desc(core_notification_deliveries.id))
    .limit(limit + 1);

  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? (rows[limit - 1]?.id ?? null) : null,
  };
};

export const retryNotificationDelivery = async (
  c: NotificationsContext,
  deliveryId: number,
): Promise<void> => {
  const db = c.get("db");
  const [updated] = await db
    .update(core_notification_deliveries)
    .set({
      attempts: 0,
      availableAt: new Date(),
      lastError: null,
      status: "pending",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(core_notification_deliveries.id, deliveryId),
        eq(core_notification_deliveries.status, "failed"),
      ),
    )
    .returning({ id: core_notification_deliveries.id });
  if (!updated) {
    throw new HTTPException(409, {
      message: "Only failed deliveries can be retried.",
    });
  }

  await dispatchEmailDrain(c);
};

export const queueNotificationTestEmail = async (
  c: NotificationsContext,
  adminUserId: number,
): Promise<{ deliveryId: number }> => {
  if (!isEmailConfigured(c)) {
    throw new HTTPException(400, {
      message: "Notification email is not configured.",
    });
  }

  const now = new Date();
  const [delivery] = await c
    .get("db")
    .insert(core_notification_deliveries)
    .values({
      availableAt: now,
      channel: "email",
      createdAt: now,
      idempotencyKey: `test:${adminUserId}:${now.getTime()}`,
      mode: "test",
      updatedAt: now,
      userId: adminUserId,
    })
    .returning({ id: core_notification_deliveries.id });

  await dispatchEmailDrain(c);

  return { deliveryId: delivery.id };
};

const MISMATCH_SCAN_LIMIT = 500;

const findNotificationCountMismatches = async (
  c: NotificationsContext,
  userId?: number,
) => {
  const actual = c
    .get("db")
    .select({
      count: sql<number>`count(*)::integer`.as("count"),
      userId: core_notifications.userId,
    })
    .from(core_notifications)
    .where(UNREAD_SQL)
    .groupBy(core_notifications.userId)
    .as("actual");

  return await c
    .get("db")
    .select({
      actual: sql<number>`coalesce(${actual.count}, 0)`.mapWith(Number),
      stored: core_notification_user_state.unreadCount,
      userId: core_notification_user_state.userId,
    })
    .from(core_notification_user_state)
    .leftJoin(actual, eq(actual.userId, core_notification_user_state.userId))
    .where(
      and(
        sql`${core_notification_user_state.unreadCount} <> coalesce(${actual.count}, 0)`,
        userId === undefined
          ? undefined
          : eq(core_notification_user_state.userId, userId),
      ),
    )
    .limit(MISMATCH_SCAN_LIMIT);
};

export const reconcileNotifications = async (
  c: NotificationsContext,
  { dryRun, userId }: { dryRun: boolean; userId?: number },
) => {
  const mismatches = await findNotificationCountMismatches(c, userId);

  if (dryRun || mismatches.length === 0) {
    return { corrected: 0, mismatched: mismatches.length };
  }

  const { corrected } = await reconcileNotificationCounts(
    c,
    mismatches.map(row => row.userId),
  );

  return { corrected, mismatched: mismatches.length };
};
