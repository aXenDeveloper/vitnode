import { and, eq, inArray, isNull, lt, lte, notExists, sql } from "drizzle-orm";

import {
  core_notification_deliveries,
  core_notification_events,
  core_notification_receipts,
  core_notifications,
} from "@/database/notifications";
import { core_queue } from "@/database/queue";

import type { NotificationsContext } from "./shared";

import { planNotificationDigests, reclaimStaleDeliveries } from "./email";
import { dispatchEmailDrain } from "./email-queue";
import { removeNotificationItems } from "./inbox";
import {
  getNotificationWorkers,
  loadNotificationSettings,
  NOTIFICATIONS_PLUGIN_ID,
  QUEUE_NOTIFICATIONS_FANOUT,
} from "./shared";

const DAY = 24 * 60 * 60 * 1000;
const STALLED_EVENT_MINUTES = 10;
/** Digest receipts nobody claimed in this long are dropped from email. */
const PENDING_EMAIL_MAX_DAYS = 14;
const DELETE_BATCH = 1000;

/**
 * Removes inbox items, events and delivery records older than the retention
 * period. Items go through `removeNotificationItems`, so unread ones come off
 * their owner's count in the same transaction; events are only deleted once
 * no inbox item points at them.
 */
export const runNotificationCleanup = async (
  c: NotificationsContext,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ deliveries: number; events: number; items: number }> => {
  const db = c.get("db");
  const { retentionDays } = getNotificationWorkers(c);
  const cutoff = new Date(now.getTime() - retentionDays * DAY);

  const items = await removeNotificationItems(c, {
    where: lt(core_notifications.lastActivityAt, cutoff),
  });

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
                lt(core_notification_events.createdAt, cutoff),
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

  let deliveries = 0;
  for (;;) {
    const deleted = await db
      .delete(core_notification_deliveries)
      .where(
        inArray(
          core_notification_deliveries.id,
          db
            .select({ id: core_notification_deliveries.id })
            .from(core_notification_deliveries)
            .where(
              and(
                lt(core_notification_deliveries.createdAt, cutoff),
                inArray(core_notification_deliveries.status, [
                  "sent",
                  "skipped",
                  "failed",
                ]),
              ),
            )
            .limit(DELETE_BATCH),
        ),
      )
      .returning({ id: core_notification_deliveries.id });
    deliveries += deleted.length;
    if (deleted.length < DELETE_BATCH) break;
  }

  await db
    .update(core_notification_receipts)
    .set({ emailPending: false })
    .where(
      and(
        eq(core_notification_receipts.emailPending, true),
        isNull(core_notification_receipts.emailDeliveryId),
        lt(
          core_notification_receipts.createdAt,
          new Date(now.getTime() - PENDING_EMAIL_MAX_DAYS * DAY),
        ),
      ),
    );

  return { deliveries, events, items };
};

/**
 * Re-queues fan-out for events left unfinished with no task to finish them -
 * e.g. their task ran out of attempts while the database was down.
 */
export const recoverStalledEvents = async (
  c: NotificationsContext,
  now = new Date(),
): Promise<number> => {
  const db = c.get("db");
  const stalled = await db
    .select({ id: core_notification_events.id })
    .from(core_notification_events)
    .where(
      and(
        inArray(core_notification_events.status, ["pending", "processing"]),
        lt(
          core_notification_events.createdAt,
          new Date(now.getTime() - STALLED_EVENT_MINUTES * 60_000),
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(core_queue)
            .where(
              and(
                eq(core_queue.pluginId, NOTIFICATIONS_PLUGIN_ID),
                eq(core_queue.name, QUEUE_NOTIFICATIONS_FANOUT),
                inArray(core_queue.status, ["pending", "processing"]),
                sql`${core_queue.payload}->>'eventId' = ${core_notification_events.id}::text`,
              ),
            ),
        ),
      ),
    )
    .limit(100);

  for (const { id } of stalled) {
    await c.get("queue").dispatch({
      name: QUEUE_NOTIFICATIONS_FANOUT,
      payload: { eventId: id },
      pluginId: NOTIFICATIONS_PLUGIN_ID,
      priority: 10,
    });
  }

  return stalled.length;
};

/** The periodic tick: recovery first, then digests, then make sure email drains. */
export const runNotificationSchedule = async (
  c: NotificationsContext,
  { now = new Date() }: { now?: Date } = {},
) => {
  const { global } = await loadNotificationSettings(c.get("db"));
  if (global.paused) {
    return { digests: { deliveries: 0, users: 0 }, reclaimed: 0, recovered: 0 };
  }

  const reclaimed = await reclaimStaleDeliveries(c, now);
  const recovered = await recoverStalledEvents(c, now);
  const digests = await planNotificationDigests(c, { now });

  const [due] = await c
    .get("db")
    .select({ id: core_notification_deliveries.id })
    .from(core_notification_deliveries)
    .where(
      and(
        eq(core_notification_deliveries.status, "pending"),
        lte(core_notification_deliveries.availableAt, now),
      ),
    )
    .limit(1);
  if (due) await dispatchEmailDrain(c);

  return { digests, reclaimed, recovered };
};
