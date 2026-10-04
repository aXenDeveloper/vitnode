import type { SQL } from "drizzle-orm";

import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";

import type { RegisteredNotificationType } from "@/api/lib/notifications/registry";
import type { NotificationStateMessage } from "@/lib/notifications/types";

import { resolveNotificationChannels } from "@/api/lib/notifications/preferences";
import { parseStoredNotificationData } from "@/api/lib/notifications/registry";
import {
  core_notification_deliveries,
  core_notification_events,
  core_notification_receipts,
  core_notification_subscriptions,
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";
import { core_users } from "@/database/users";

import type {
  NotificationsContext,
  NotificationsDb,
  NotificationSettingsSnapshot,
} from "./shared";

import { dispatchEmailDrain } from "./email-queue";
import {
  getNotificationRegistry,
  getNotificationWorkers,
  isEmailConfigured,
  loadNotificationSettings,
  sendNotificationStates,
} from "./shared";

type EventRow = typeof core_notification_events.$inferSelect;
type StateUpdate = NotificationStateMessage & { userId: number };

/** `(a, b), (c, d)` - rows for a `VALUES` list. */
export const valuesList = (rows: SQL[][]): SQL =>
  sql.join(
    rows.map(row => sql`(${sql.join(row, sql`, `)})`),
    sql`, `,
  );

/**
 * Creates the user-state rows a batch needs and locks them, always in user id
 * order. Every inbox write takes these locks first, so two writers touching
 * the same users can never deadlock, and a user's inbox changes serialize.
 */
export const lockUserStates = async (
  tx: NotificationsDb,
  userIds: number[],
) => {
  const sorted = [...new Set(userIds)].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  await tx
    .insert(core_notification_user_state)
    .values(sorted.map(userId => ({ userId })))
    .onConflictDoNothing();

  return await tx
    .select({
      preferences: core_notification_user_state.preferences,
      userId: core_notification_user_state.userId,
    })
    .from(core_notification_user_state)
    .where(inArray(core_notification_user_state.userId, sorted))
    .orderBy(asc(core_notification_user_state.userId))
    .for("update");
};

/**
 * Applies unread-count deltas to rows already locked by `lockUserStates`,
 * bumping each user's revision exactly once.
 */
export const applyUnreadDeltas = async (
  tx: NotificationsDb,
  deltas: Map<number, number>,
  reason: NotificationStateMessage["reason"],
  notificationId?: number,
): Promise<StateUpdate[]> => {
  if (deltas.size === 0) return [];

  const byDelta = new Map<number, number[]>();
  for (const [userId, delta] of deltas) {
    byDelta.set(delta, [...(byDelta.get(delta) ?? []), userId]);
  }

  const updates: StateUpdate[] = [];
  for (const [delta, userIds] of byDelta) {
    const rows = await tx
      .update(core_notification_user_state)
      .set({
        revision: sql`${core_notification_user_state.revision} + 1`,
        unreadCount: sql`GREATEST(0, ${core_notification_user_state.unreadCount} + ${delta})`,
        updatedAt: new Date(),
      })
      .where(inArray(core_notification_user_state.userId, userIds))
      .returning({
        revision: core_notification_user_state.revision,
        unread: core_notification_user_state.unreadCount,
        userId: core_notification_user_state.userId,
      });

    updates.push(
      ...rows.map(row => ({
        ...row,
        reason,
        ...(notificationId === undefined ? {} : { notificationId }),
      })),
    );
  }

  return updates;
};

interface Candidates {
  cursors: Pick<
    EventRow,
    "followerSubjectCursor" | "followerUserCursor" | "recipientCursor"
  >;
  done: boolean;
  userIds: number[];
}

const nextCandidates = async (
  tx: NotificationsDb,
  event: EventRow,
  batchSize: number,
): Promise<Candidates> => {
  if (event.recipientCursor < event.recipientIds.length) {
    const userIds = event.recipientIds.slice(
      event.recipientCursor,
      event.recipientCursor + batchSize,
    );
    const recipientCursor = event.recipientCursor + userIds.length;

    return {
      cursors: { ...event, recipientCursor },
      done:
        recipientCursor >= event.recipientIds.length &&
        event.followersOf.length === 0,
      userIds,
    };
  }

  const subject = event.followersOf[event.followerSubjectCursor];
  if (!subject) return { cursors: event, done: true, userIds: [] };

  const rows = await tx
    .select({ userId: core_notification_subscriptions.userId })
    .from(core_notification_subscriptions)
    .where(
      and(
        eq(core_notification_subscriptions.subjectType, subject.type),
        eq(core_notification_subscriptions.subjectId, subject.id),
        eq(core_notification_subscriptions.state, "following"),
        gt(core_notification_subscriptions.userId, event.followerUserCursor),
      ),
    )
    .orderBy(asc(core_notification_subscriptions.userId))
    .limit(batchSize);

  const userIds = rows.map(row => row.userId);
  const exhausted = userIds.length < batchSize;
  const followerSubjectCursor =
    event.followerSubjectCursor + (exhausted ? 1 : 0);

  return {
    cursors: {
      followerSubjectCursor,
      followerUserCursor: exhausted ? 0 : (userIds.at(-1) ?? 0),
      recipientCursor: event.recipientCursor,
    },
    done: exhausted && followerSubjectCursor >= event.followersOf.length,
    userIds,
  };
};

interface BatchResult {
  delivered: number;
  done: boolean;
  states: StateUpdate[];
}

const failEvent = async (tx: NotificationsDb, id: number, error: string) => {
  await tx
    .update(core_notification_events)
    .set({ completedAt: new Date(), lastError: error, status: "failed" })
    .where(eq(core_notification_events.id, id));
};

/** Narrows candidates to who may and wants to receive this event. */
const filterRecipients = async ({
  c,
  candidates,
  data,
  event,
  registered,
}: {
  c: NotificationsContext;
  candidates: number[];
  data: unknown;
  event: EventRow;
  registered: RegisteredNotificationType;
}) => {
  const notSelf = candidates.filter(
    id => event.allowSelf || id !== event.actorId,
  );
  if (notSelf.length === 0) return { eligible: [], muted: new Set<number>() };

  const db = c.get("db");
  const existing = await db
    .select({ id: core_users.id })
    .from(core_users)
    .where(inArray(core_users.id, notSelf));
  let eligible = existing.map(row => row.id);

  const subject =
    event.subjectType && event.subjectId
      ? { id: event.subjectId, type: event.subjectType }
      : null;

  const muted = new Set<number>();
  if (subject && eligible.length > 0) {
    const rows = await db
      .select({ userId: core_notification_subscriptions.userId })
      .from(core_notification_subscriptions)
      .where(
        and(
          eq(core_notification_subscriptions.subjectType, subject.type),
          eq(core_notification_subscriptions.subjectId, subject.id),
          eq(core_notification_subscriptions.state, "muted"),
          inArray(core_notification_subscriptions.userId, eligible),
        ),
      );
    rows.forEach(row => muted.add(row.userId));
  }

  const { access } = registered.definition;
  if (access && eligible.length > 0) {
    const allowed = new Set(
      await access({ c, data, subject, userIds: [...eligible] }),
    );
    eligible = eligible.filter(id => allowed.has(id));
  }

  return { eligible, muted };
};

const processBatch = async (
  c: NotificationsContext,
  tx: NotificationsDb,
  eventId: number,
  settings: NotificationSettingsSnapshot,
): Promise<BatchResult> => {
  const [event] = await tx
    .select()
    .from(core_notification_events)
    .where(eq(core_notification_events.id, eventId))
    .for("update");

  if (!event || event.status === "completed" || event.status === "failed") {
    return { delivered: 0, done: true, states: [] };
  }

  const registered = getNotificationRegistry(c).get(event.type);
  if (registered?.pluginId !== event.pluginId) {
    await failEvent(tx, event.id, "Notification type is not registered.");

    return { delivered: 0, done: true, states: [] };
  }

  const { definition } = registered;
  const data = parseStoredNotificationData(
    definition,
    event.data,
    event.schemaVersion,
  );
  if (data === null) {
    await failEvent(tx, event.id, "Event data no longer matches its schema.");

    return { delivered: 0, done: true, states: [] };
  }

  const candidates = await nextCandidates(
    tx,
    event,
    getNotificationWorkers(c).fanoutBatchSize,
  );
  const { eligible, muted } = await filterRecipients({
    c,
    candidates: candidates.userIds,
    data,
    event,
    registered,
  });

  const now = new Date();
  const states: StateUpdate[] = [];
  let delivered = 0;

  const locked = await lockUserStates(tx, eligible);
  const emailConfigured = isEmailConfigured(c, settings);
  const policy = settings.policies.get(definition.id);
  const channels = new Map(
    locked.map(row => [
      row.userId,
      resolveNotificationChannels({
        definition,
        emailConfigured,
        muted: muted.has(row.userId),
        policy,
        preference: row.preferences[definition.id],
      }),
    ]),
  );

  const receiving = [...channels].filter(
    ([, channel]) => channel.inApp || channel.email !== "none",
  );

  if (receiving.length > 0) {
    const inserted = await tx
      .insert(core_notification_receipts)
      .values(
        receiving.map(([userId, channel]) => ({
          createdAt: now,
          emailPending: channel.email !== "none",
          eventId: event.id,
          userId,
        })),
      )
      .onConflictDoNothing()
      .returning({ userId: core_notification_receipts.userId });

    // Only users whose receipt is new go further: a retry of a batch that
    // already committed finds every receipt in place and changes nothing.
    const fresh = inserted.map(row => row.userId).sort((a, b) => a - b);
    const inApp = fresh.filter(userId => channels.get(userId)?.inApp);

    if (inApp.length > 0) {
      const groupKey = event.groupKey ?? `event:${event.id}`;
      const groupBucket =
        event.groupKey && definition.grouping
          ? Math.floor(
              event.createdAt.getTime() /
                (definition.grouping.windowMinutes * 60_000),
            )
          : 0;

      const previous = await tx
        .select({
          activitySeq: core_notifications.activitySeq,
          archivedAt: core_notifications.archivedAt,
          readSeq: core_notifications.readSeq,
          userId: core_notifications.userId,
        })
        .from(core_notifications)
        .where(
          and(
            inArray(core_notifications.userId, inApp),
            eq(core_notifications.pluginId, event.pluginId),
            eq(core_notifications.type, event.type),
            eq(core_notifications.groupKey, groupKey),
            eq(core_notifications.groupBucket, groupBucket),
          ),
        );
      const wasCounted = new Map(
        previous.map(row => [
          row.userId,
          row.archivedAt === null && row.readSeq < row.activitySeq,
        ]),
      );

      const items = await tx
        .insert(core_notifications)
        .values(
          inApp.map(userId => ({
            activitySeq: 1,
            category: definition.category,
            createdAt: now,
            eventCount: 1,
            groupBucket,
            groupKey,
            lastActivityAt: now,
            latestEventId: event.id,
            pluginId: event.pluginId,
            readSeq: 0,
            subjectId: event.subjectId,
            subjectType: event.subjectType,
            type: event.type,
            userId,
          })),
        )
        .onConflictDoUpdate({
          set: {
            activitySeq: sql`${core_notifications.activitySeq} + 1`,
            archivedAt: null,
            eventCount: sql`${core_notifications.eventCount} + 1`,
            lastActivityAt: sql`excluded."lastActivityAt"`,
            latestEventId: sql`excluded."latestEventId"`,
          },
          target: [
            core_notifications.userId,
            core_notifications.pluginId,
            core_notifications.type,
            core_notifications.groupKey,
            core_notifications.groupBucket,
          ],
        })
        .returning({
          activitySeq: core_notifications.activitySeq,
          id: core_notifications.id,
          userId: core_notifications.userId,
        });

      await tx.execute(sql`
        UPDATE ${core_notification_receipts} AS r
        SET "notificationId" = v.nid, "seq" = v.seq
        FROM (VALUES ${valuesList(
          items.map(item => [
            sql`${item.userId}::integer`,
            sql`${item.id}::bigint`,
            sql`${item.activitySeq}::integer`,
          ]),
        )}) AS v(uid, nid, seq)
        WHERE r."eventId" = ${event.id} AND r."userId" = v.uid
      `);

      const deltas = new Map(
        inApp.map(userId => [userId, wasCounted.get(userId) ? 0 : 1]),
      );
      states.push(...(await applyUnreadDeltas(tx, deltas, "created")));
      delivered = inApp.length;
    }

    const immediate = fresh.filter(
      userId => channels.get(userId)?.email === "immediate",
    );
    if (immediate.length > 0) {
      const deliveries = await tx
        .insert(core_notification_deliveries)
        .values(
          immediate.map(userId => ({
            availableAt: now,
            channel: "email" as const,
            createdAt: now,
            eventId: event.id,
            idempotencyKey: `immediate:${event.id}:${userId}`,
            mode: "immediate" as const,
            updatedAt: now,
            userId,
          })),
        )
        .onConflictDoNothing()
        .returning({
          id: core_notification_deliveries.id,
          userId: core_notification_deliveries.userId,
        });

      if (deliveries.length > 0) {
        await tx.execute(sql`
          UPDATE ${core_notification_receipts} AS r
          SET "emailDeliveryId" = v.did
          FROM (VALUES ${valuesList(
            deliveries.map(row => [
              sql`${row.userId}::integer`,
              sql`${row.id}::bigint`,
            ]),
          )}) AS v(uid, did)
          WHERE r."eventId" = ${event.id} AND r."userId" = v.uid
        `);
        await dispatchEmailDrain(c, tx);
      }
    }
  }

  await tx
    .update(core_notification_events)
    .set({
      ...candidates.cursors,
      completedAt: candidates.done ? now : null,
      deliveredCount: sql`${core_notification_events.deliveredCount} + ${delivered}`,
      lastError: null,
      status: candidates.done ? "completed" : "processing",
    })
    .where(eq(core_notification_events.id, event.id));

  return { delivered, done: candidates.done, states };
};

export interface FanoutResult {
  batches: number;
  delivered: number;
  done: boolean;
  paused?: boolean;
}

/**
 * Delivers an event batch by batch, each in its own short transaction that
 * also saves the cursor - a crash or retry resumes after the last committed
 * batch. Stops after `timeBudgetMs` so one huge audience cannot hold the
 * queue worker; the caller re-queues the rest.
 */
export const processNotificationEvent = async (
  c: NotificationsContext,
  eventId: number,
  { timeBudgetMs = 20_000 }: { timeBudgetMs?: number } = {},
): Promise<FanoutResult> => {
  const db = c.get("db");
  const settings = await loadNotificationSettings(db);
  const deadline = Date.now() + timeBudgetMs;
  const result: FanoutResult = { batches: 0, delivered: 0, done: false };
  if (settings.global.paused) return { ...result, done: true, paused: true };

  while (!result.done) {
    const batch = await db.transaction(
      async tx => await processBatch(c, tx, eventId, settings),
    );
    sendNotificationStates(c, batch.states);

    result.batches += 1;
    result.delivered += batch.delivered;
    result.done = batch.done;

    if (!result.done && Date.now() >= deadline) break;
  }

  return result;
};
