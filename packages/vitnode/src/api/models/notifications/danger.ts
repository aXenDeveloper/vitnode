import { and, eq, inArray, isNull, notExists, sql } from "drizzle-orm";

import {
  core_notification_deliveries,
  core_notification_events,
  core_notification_receipts,
  core_notification_settings,
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";

import type { NotificationsContext } from "./shared";

import { dispatchEmailDrain } from "./email-queue";
import { applyUnreadDeltas, lockUserStates } from "./fanout";
import { removeNotificationItems, UNREAD_SQL } from "./inbox";
import {
  GLOBAL_SETTINGS_KEY,
  loadNotificationSettings,
  NOTIFICATIONS_PLUGIN_ID,
  QUEUE_NOTIFICATIONS_FANOUT,
  sendNotificationStates,
} from "./shared";

const USERS_PER_BATCH = 200;
const DELETE_BATCH = 1000;

const setPaused = async (c: NotificationsContext, paused: boolean) => {
  const { global } = await loadNotificationSettings(c.get("db"));
  const value = { ...global, paused };
  await c
    .get("db")
    .insert(core_notification_settings)
    .values({ key: GLOBAL_SETTINGS_KEY, updatedAt: new Date(), value })
    .onConflictDoUpdate({
      set: { updatedAt: new Date(), value },
      target: core_notification_settings.key,
    });
};

export const pauseNotifications = async (c: NotificationsContext) => {
  await setPaused(c, true);
  await c.get("events").emit("notifications.paused", {});
};

export const resumeNotifications = async (
  c: NotificationsContext,
): Promise<{ requeuedEvents: number }> => {
  await setPaused(c, false);

  const waiting = await c
    .get("db")
    .select({ id: core_notification_events.id })
    .from(core_notification_events)
    .where(inArray(core_notification_events.status, ["pending", "processing"]));

  for (const { id } of waiting) {
    await c.get("queue").dispatch({
      name: QUEUE_NOTIFICATIONS_FANOUT,
      payload: { eventId: id },
      pluginId: NOTIFICATIONS_PLUGIN_ID,
      priority: 10,
    });
  }
  await dispatchEmailDrain(c);
  await c
    .get("events")
    .emit("notifications.resumed", { requeuedEvents: waiting.length });

  return { requeuedEvents: waiting.length };
};

export const cancelQueuedNotificationEmails = async (
  c: NotificationsContext,
): Promise<{ cancelled: number }> => {
  const cancelled = await c.get("db").transaction(async tx => {
    const rows = await tx
      .update(core_notification_deliveries)
      .set({
        skipReason: "cancelled",
        status: "skipped",
        updatedAt: new Date(),
      })
      .where(eq(core_notification_deliveries.status, "pending"))
      .returning({ id: core_notification_deliveries.id });

    await tx
      .update(core_notification_receipts)
      .set({ emailPending: false })
      .where(
        and(
          eq(core_notification_receipts.emailPending, true),
          rows.length === 0
            ? isNull(core_notification_receipts.emailDeliveryId)
            : sql`(${core_notification_receipts.emailDeliveryId} IS NULL OR ${inArray(
                core_notification_receipts.emailDeliveryId,
                rows.map(row => row.id),
              )})`,
        ),
      );

    return rows.length;
  });

  await c
    .get("events")
    .emit("notifications.emails_cancelled", { count: cancelled });

  return { cancelled };
};

export const markEverythingRead = async (
  c: NotificationsContext,
): Promise<{ items: number; members: number }> => {
  let items = 0;
  let members = 0;

  for (;;) {
    const targets = await c
      .get("db")
      .selectDistinct({ userId: core_notifications.userId })
      .from(core_notifications)
      .where(UNREAD_SQL)
      .limit(USERS_PER_BATCH);
    if (targets.length === 0) break;

    const userIds = targets.map(row => row.userId);
    const result = await c.get("db").transaction(async tx => {
      await lockUserStates(tx, userIds);
      const marked = await tx
        .update(core_notifications)
        .set({
          readAt: new Date(),
          readSeq: sql`${core_notifications.activitySeq}`,
        })
        .where(and(UNREAD_SQL, inArray(core_notifications.userId, userIds)))
        .returning({ userId: core_notifications.userId });

      const deltas = new Map<number, number>();
      for (const row of marked)
        deltas.set(row.userId, (deltas.get(row.userId) ?? 0) - 1);

      return {
        count: marked.length,
        updates: await applyUnreadDeltas(tx, deltas, "read_all"),
      };
    });

    sendNotificationStates(c, result.updates);
    items += result.count;
    members += result.updates.length;
    if (result.count === 0) break;
  }

  await c.get("events").emit("notifications.read_all", { items, members });

  return { items, members };
};

export const deleteAllNotifications = async (
  c: NotificationsContext,
): Promise<{ events: number; items: number }> => {
  const db = c.get("db");
  const items = await removeNotificationItems(c, { where: sql`true` });

  let events = 0;
  for (;;) {
    const deleted = await db
      .delete(core_notification_events)
      .where(
        inArray(
          core_notification_events.id,
          db
            .select({ id: core_notification_events.id })
            .from(core_notification_events)
            .where(
              and(
                inArray(core_notification_events.status, [
                  "completed",
                  "failed",
                ]),
                notExists(
                  db
                    .select({ one: sql`1` })
                    .from(core_notifications)
                    .where(
                      eq(
                        core_notifications.latestEventId,
                        core_notification_events.id,
                      ),
                    ),
                ),
              ),
            )
            .limit(DELETE_BATCH),
        ),
      )
      .returning({ id: core_notification_events.id });
    events += deleted.length;
    if (deleted.length < DELETE_BATCH) break;
  }

  await c.get("events").emit("notifications.deleted_all", { items });

  return { events, items };
};

export const resetMemberNotificationPreferences = async (
  c: NotificationsContext,
): Promise<{ members: number }> => {
  const rows = await c
    .get("db")
    .update(core_notification_user_state)
    .set({
      preferences: sql`'{}'::jsonb`,
      updatedAt: new Date(),
    })
    .where(sql`${core_notification_user_state.preferences} <> '{}'::jsonb`)
    .returning({ userId: core_notification_user_state.userId });

  await c
    .get("events")
    .emit("notifications.preferences_reset", { members: rows.length });

  return { members: rows.length };
};
