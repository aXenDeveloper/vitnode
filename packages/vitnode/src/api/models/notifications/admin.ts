import { and, count, desc, eq, inArray, like, lt, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type {
  NotificationGlobalSettings,
  NotificationTypePolicy,
} from "@/api/lib/notifications/preferences";

import { isNotificationEmailAvailable } from "@/api/lib/notifications/preferences";
import { core_cron } from "@/database/cron";
import {
  core_notification_deliveries,
  core_notification_events,
  core_notification_settings,
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";
import { core_queue } from "@/database/queue";
import { isCronStale } from "@/lib/api/is-cron-stale";

import type { NotificationsContext } from "./shared";

import { dispatchEmailDrain } from "./email-queue";
import { reconcileNotificationCounts } from "./inbox";
import {
  getNotificationRegistry,
  GLOBAL_SETTINGS_KEY,
  isEmailConfigured,
  loadNotificationSettings,
  normalizeGlobalSettings,
  NOTIFICATIONS_PLUGIN_ID,
  QUEUE_NOTIFICATIONS_CLEANUP,
  typeSettingsKey,
} from "./shared";

const countBy = <K extends string>(rows: { count: number; key: K }[]) =>
  Object.fromEntries(rows.map(row => [row.key, row.count])) as Partial<
    Record<K, number>
  >;

/**
 * Everything the AdminCP overview shows. Only aggregates and type metadata -
 * no notification content and no recipient data.
 */
export const getNotificationsOverview = async (c: NotificationsContext) => {
  const db = c.get("db");
  const core = c.get("core");
  const settings = await loadNotificationSettings(db);
  const emailConfigured = isEmailConfigured(c, settings);

  const [queueRows, deliveryRows, eventRows, [oldestPending], [cron]] =
    await Promise.all([
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
      db
        .select({
          lastActivity: sql<
            null | string
          >`max(coalesce(${core_cron.lastRun}, ${core_cron.createdAt}))`,
        })
        .from(core_cron),
    ]);

  return {
    email: {
      adapterConfigured: !!core.email?.adapter,
      enabled: settings.global.emailEnabled,
    },
    health: {
      cronActive: core.hasCronAdapter,
      cronStale: isCronStale(
        cron?.lastActivity ? new Date(cron.lastActivity) : null,
      ),
      deliveries: countBy(deliveryRows),
      events: countBy(eventRows),
      oldestPendingEventAt: oldestPending?.createdAt ?? null,
      queue: countBy(queueRows),
    },
    settings: settings.global,
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
        label: definition.label,
        mandatory: !!definition.mandatory,
        pluginId,
        policy: {
          allowEmail: policy.allowEmail ?? true,
          email: policy.email ?? null,
          enabled: policy.enabled ?? true,
          inApp: policy.inApp ?? null,
        },
        version: definition.version,
      };
    }),
  };
};

const upsertSetting = async (
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

export const updateNotificationGlobalSettings = async (
  c: NotificationsContext,
  patch: Partial<NotificationGlobalSettings>,
): Promise<NotificationGlobalSettings> => {
  const { global } = await loadNotificationSettings(c.get("db"));
  const next = normalizeGlobalSettings({ ...global, ...patch });
  await upsertSetting(c, GLOBAL_SETTINGS_KEY, { ...next });

  return next;
};

export const updateNotificationTypePolicy = async (
  c: NotificationsContext,
  typeId: string,
  policy: NotificationTypePolicy,
): Promise<void> => {
  const registered = getNotificationRegistry(c).get(typeId);
  if (!registered) throw new HTTPException(404);
  if (policy.email && policy.email !== "none" && !registered.definition.email) {
    throw new HTTPException(400, {
      message: "This type has no email channel.",
    });
  }

  await upsertSetting(c, typeSettingsKey(typeId), {
    ...(policy.allowEmail === undefined
      ? {}
      : { allowEmail: policy.allowEmail }),
    ...(policy.email === undefined ? {} : { email: policy.email }),
    ...(policy.enabled === undefined ? {} : { enabled: policy.enabled }),
    ...(policy.inApp === undefined ? {} : { inApp: policy.inApp }),
  });
};

/**
 * Delivery records for diagnosis. Deliberately leaves out addresses, subjects
 * and content: the type, mode, attempts and a sanitized error are what an
 * admin needs to find the fault, and the recipient stays a user id.
 */
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

/**
 * Puts a failed delivery back in line with a fresh set of attempts. It keeps
 * its row and idempotency key, so the provider sees the same key and the
 * same receipts are rendered - a retry can never fan out into a second email.
 */
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

/** Queues a test notification email to the signed-in admin - nobody else. */
export const queueNotificationTestEmail = async (
  c: NotificationsContext,
  adminUserId: number,
): Promise<{ deliveryId: number }> => {
  const settings = await loadNotificationSettings(c.get("db"));
  if (!isEmailConfigured(c, settings)) {
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

/** Users whose stored unread count disagrees with their inbox. */
export const findNotificationCountMismatches = async (
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
    .where(
      sql`${core_notifications.archivedAt} IS NULL AND ${core_notifications.readSeq} < ${core_notifications.activitySeq}`,
    )
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

export const queueNotificationCleanup = async (c: NotificationsContext) => {
  await c.get("queue").dispatch({
    name: QUEUE_NOTIFICATIONS_CLEANUP,
    pluginId: NOTIFICATIONS_PLUGIN_ID,
  });
};
