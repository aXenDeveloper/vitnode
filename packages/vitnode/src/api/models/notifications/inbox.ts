import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type {
  NotificationState,
  NotificationStateMessage,
  NotificationSubject,
} from "@/lib/notifications/types";

import {
  core_notification_events,
  core_notification_user_state,
  core_notifications,
} from "@/database/notifications";

import type { NotificationActor } from "./render";
import type { NotificationsContext, NotificationsDb } from "./shared";

import { applyUnreadDeltas, lockUserStates } from "./fanout";
import {
  checkNotificationAccess,
  createTranslatorCache,
  loadActorSummaries,
  presentNotification,
  resolveEvent,
} from "./render";
import { sendNotificationStates } from "./shared";

type StateUpdate = NotificationStateMessage & { userId: number };

export const UNREAD_SQL = sql`${core_notifications.archivedAt} IS NULL AND ${core_notifications.readSeq} < ${core_notifications.activitySeq}`;

export interface NotificationListItem {
  /** Pass back to `markRead` - the read boundary of what was shown. */
  activitySeq: number;
  /** Distinct actors across every grouped event. */
  actorCount: number;
  actors: NotificationActor[];
  /** `false` when the content is gone, access was lost or the plugin is uninstalled. */
  available: boolean;
  body: null | string;
  category: string;
  createdAt: Date;
  eventCount: number;
  id: number;
  lastActivityAt: Date;
  pluginId: string;
  readAt: Date | null;
  subject: NotificationSubject | null;
  target: null | string;
  title: string;
  type: string;
  unread: boolean;
}

export interface NotificationListPage {
  items: NotificationListItem[];
  nextCursor: null | string;
}

interface Cursor {
  id: number;
  t: number;
}

const encodeCursor = (cursor: Cursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

const decodeCursor = (raw: string): Cursor => {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      "t" in parsed &&
      Number.isSafeInteger(parsed.id) &&
      Number.isSafeInteger(parsed.t)
    ) {
      return parsed as Cursor;
    }
  } catch {
    // fall through
  }

  throw new HTTPException(400, { message: "Invalid pagination cursor." });
};

export const getNotificationState = async (
  db: NotificationsDb,
  userId: number,
): Promise<NotificationState> => {
  const [row] = await db
    .select({
      revision: core_notification_user_state.revision,
      unread: core_notification_user_state.unreadCount,
    })
    .from(core_notification_user_state)
    .where(eq(core_notification_user_state.userId, userId))
    .limit(1);

  return row ?? { revision: 0, unread: 0 };
};

/**
 * One page of a user's inbox, newest activity first. Every item is re-checked
 * against its type before anything is returned: an item whose content is gone,
 * whose access was revoked or whose plugin is uninstalled comes back as an
 * `available: false` placeholder - no title, link or actors - so it can still
 * be read or archived instead of silently inflating the count.
 */
export const listNotifications = async (
  c: NotificationsContext,
  {
    category,
    cursor,
    language,
    limit,
    type,
    unreadOnly,
    userId,
  }: {
    category?: string;
    cursor?: string;
    language?: string;
    limit: number;
    type?: string;
    unreadOnly?: boolean;
    userId: number;
  },
): Promise<NotificationListPage> => {
  const after = cursor ? decodeCursor(cursor) : null;
  const afterDate = after ? new Date(after.t) : null;

  const rows = await c
    .get("db")
    .select({
      item: core_notifications,
      event: core_notification_events,
    })
    .from(core_notifications)
    .innerJoin(
      core_notification_events,
      eq(core_notification_events.id, core_notifications.latestEventId),
    )
    .where(
      and(
        eq(core_notifications.userId, userId),
        isNull(core_notifications.archivedAt),
        unreadOnly ? UNREAD_SQL : undefined,
        category ? eq(core_notifications.category, category) : undefined,
        type ? eq(core_notifications.type, type) : undefined,
        after && afterDate
          ? or(
              lt(core_notifications.lastActivityAt, afterDate),
              and(
                eq(core_notifications.lastActivityAt, afterDate),
                lt(core_notifications.id, after.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(
      desc(core_notifications.lastActivityAt),
      desc(core_notifications.id),
    )
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const summaries = await loadActorSummaries(
    c,
    page.map(row => row.item.id),
  );
  const translator = createTranslatorCache(c);
  const { locale, t } = await translator(language);

  const items = await Promise.all(
    page.map(async ({ event, item }): Promise<NotificationListItem> => {
      const base = {
        activitySeq: item.activitySeq,
        category: item.category,
        createdAt: item.createdAt,
        eventCount: item.eventCount,
        id: item.id,
        lastActivityAt: item.lastActivityAt,
        pluginId: item.pluginId,
        readAt: item.readAt,
        type: item.type,
        unread: item.readSeq < item.activitySeq,
      };
      const unavailable: NotificationListItem = {
        ...base,
        actorCount: 0,
        actors: [],
        available: false,
        body: null,
        subject: null,
        target: null,
        title: t("core.notifications.unavailable"),
      };

      const resolved = resolveEvent(c, event);
      if (!resolved) return unavailable;

      try {
        const allowed = await checkNotificationAccess({
          c,
          data: resolved.data,
          event,
          registered: resolved.registered,
          userIds: [userId],
        });
        if (!allowed.has(userId)) return unavailable;
      } catch {
        return unavailable;
      }

      const actors = summaries.get(item.id) ?? { actorCount: 0, actors: [] };
      const presented = presentNotification(c, {
        actors,
        data: resolved.data,
        event,
        eventCount: item.eventCount,
        locale,
        registered: resolved.registered,
        t,
      });
      if (!presented) return unavailable;

      return {
        ...base,
        actorCount: actors.actorCount,
        actors: actors.actors,
        available: true,
        body: presented.body ?? null,
        subject:
          item.subjectType && item.subjectId
            ? { id: item.subjectId, type: item.subjectType }
            : null,
        target: presented.target,
        title: presented.title,
      };
    }),
  );

  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({
            id: last.item.id,
            t: last.item.lastActivityAt.getTime(),
          })
        : null,
  };
};

type ItemRow = typeof core_notifications.$inferSelect;

const isCounted = (
  item: Pick<ItemRow, "activitySeq" | "archivedAt" | "readSeq">,
) => item.archivedAt === null && item.readSeq < item.activitySeq;

/**
 * Runs one item change under the user's state lock and applies the change to
 * the canonical count in the same transaction. Returns the new state, which is
 * pushed to the user's connections only after commit.
 */
const changeItem = async (
  c: NotificationsContext,
  {
    change,
    notificationId,
    reason,
    userId,
  }: {
    change: (item: ItemRow, now: Date) => null | Partial<ItemRow>;
    notificationId: number;
    reason: NotificationStateMessage["reason"];
    userId: number;
  },
): Promise<NotificationState> => {
  const result = await c.get("db").transaction(async tx => {
    await lockUserStates(tx, [userId]);

    // Scoped by user: someone else's id is indistinguishable from a missing one.
    const [item] = await tx
      .select()
      .from(core_notifications)
      .where(
        and(
          eq(core_notifications.id, notificationId),
          eq(core_notifications.userId, userId),
        ),
      )
      .limit(1);
    if (!item) throw new HTTPException(404);

    const now = new Date();
    const patch = change(item, now);
    if (!patch)
      return { state: await getNotificationState(tx, userId), update: null };

    await tx
      .update(core_notifications)
      .set(patch)
      .where(eq(core_notifications.id, item.id));

    const delta =
      Number(isCounted({ ...item, ...patch })) - Number(isCounted(item));
    const [update] = await applyUnreadDeltas(
      tx,
      new Map([[userId, delta]]),
      reason,
      item.id,
    );

    return {
      state: update ?? (await getNotificationState(tx, userId)),
      update,
    };
  });

  if (result.update) sendNotificationStates(c, [result.update]);

  return { revision: result.state.revision, unread: result.state.unread };
};

/**
 * Marks an item read up to `throughSeq` - the `activitySeq` the user saw. A
 * grouped event that arrived after the item was rendered pushes `activitySeq`
 * past that boundary, so the item correctly stays unread.
 */
export const markNotificationRead = async (
  c: NotificationsContext,
  args: { notificationId: number; throughSeq?: number; userId: number },
): Promise<NotificationState> =>
  await changeItem(c, {
    change: (item, now) => {
      const boundary = Math.min(
        args.throughSeq ?? item.activitySeq,
        item.activitySeq,
      );
      if (item.readSeq >= boundary) return null;

      return { readAt: now, readSeq: boundary };
    },
    notificationId: args.notificationId,
    reason: "read",
    userId: args.userId,
  });

export const markNotificationUnread = async (
  c: NotificationsContext,
  args: { notificationId: number; userId: number },
): Promise<NotificationState> =>
  await changeItem(c, {
    change: item =>
      item.readSeq < item.activitySeq
        ? null
        : { readAt: null, readSeq: item.activitySeq - 1 },
    notificationId: args.notificationId,
    reason: "unread",
    userId: args.userId,
  });

export const archiveNotification = async (
  c: NotificationsContext,
  args: { notificationId: number; userId: number },
): Promise<NotificationState> =>
  await changeItem(c, {
    change: (item, now) => (item.archivedAt ? null : { archivedAt: now }),
    notificationId: args.notificationId,
    reason: "archived",
    userId: args.userId,
  });

/**
 * Marks everything read in one statement, after taking the user's state lock.
 * That lock is the boundary: a fan-out that committed before it is included,
 * one still running waits for it and then adds its item as unread.
 */
export const markAllNotificationsRead = async (
  c: NotificationsContext,
  { category, userId }: { category?: string; userId: number },
): Promise<NotificationState & { marked: number }> => {
  const result = await c.get("db").transaction(async tx => {
    await lockUserStates(tx, [userId]);
    const now = new Date();

    const marked = await tx
      .update(core_notifications)
      .set({ readAt: now, readSeq: sql`${core_notifications.activitySeq}` })
      .where(
        and(
          eq(core_notifications.userId, userId),
          UNREAD_SQL,
          category ? eq(core_notifications.category, category) : undefined,
        ),
      )
      .returning({ id: core_notifications.id });

    if (marked.length === 0) {
      return {
        marked: 0,
        state: await getNotificationState(tx, userId),
        update: null,
      };
    }

    const [update] = await applyUnreadDeltas(
      tx,
      new Map([[userId, -marked.length]]),
      "read_all",
    );

    return { marked: marked.length, state: update, update };
  });

  if (result.update) sendNotificationStates(c, [result.update]);

  return {
    marked: result.marked,
    revision: result.state.revision,
    unread: result.state.unread,
  };
};

/**
 * Recounts unread items for each user from scratch and fixes the stored count
 * where it drifted. For diagnostics and recovery, not the hot path.
 */
export const reconcileNotificationCounts = async (
  c: NotificationsContext,
  userIds: number[],
): Promise<{ checked: number; corrected: number }> => {
  let corrected = 0;
  const updates: StateUpdate[] = [];

  for (let index = 0; index < userIds.length; index += 200) {
    const chunk = userIds.slice(index, index + 200);
    const changed = await c.get("db").transaction(async tx => {
      await lockUserStates(tx, chunk);

      return await tx.execute<{
        revision: number | string;
        unread: number;
        userId: number;
      }>(sql`
        UPDATE ${core_notification_user_state} AS s
        SET "unreadCount" = actual.count,
            "revision" = s."revision" + 1,
            "updatedAt" = now()
        FROM (
          SELECT u.id AS "userId", count(n.id)::integer AS count
          FROM unnest(ARRAY[${sql.join(
            chunk.map(id => sql`${id}::integer`),
            sql`, `,
          )}]) AS u(id)
          LEFT JOIN ${core_notifications} AS n
            ON n."userId" = u.id
           AND n."archivedAt" IS NULL
           AND n."readSeq" < n."activitySeq"
          GROUP BY u.id
        ) AS actual
        WHERE s."userId" = actual."userId"
          AND s."unreadCount" <> actual.count
        RETURNING s."userId" AS "userId", s."unreadCount" AS unread, s."revision" AS revision
      `);
    });

    const rows = [...changed];
    corrected += rows.length;
    updates.push(
      ...rows.map(row => ({
        reason: "reconciled" as const,
        revision: Number(row.revision),
        unread: row.unread,
        userId: row.userId,
      })),
    );
  }

  sendNotificationStates(c, updates);

  return { checked: userIds.length, corrected };
};

/**
 * Removes inbox items - when access is revoked, content is deleted or by
 * retention - and takes their unread share off each owner's count in the same
 * transaction.
 */
export const removeNotificationItems = async (
  c: NotificationsContext,
  {
    reason = "removed",
    where,
  }: {
    reason?: NotificationStateMessage["reason"];
    where: ReturnType<typeof and>;
  },
  { batchSize = 500 }: { batchSize?: number } = {},
): Promise<number> => {
  let removed = 0;

  for (;;) {
    const targets = await c
      .get("db")
      .select({ userId: core_notifications.userId })
      .from(core_notifications)
      .where(where)
      .groupBy(core_notifications.userId)
      .limit(Math.max(1, Math.floor(batchSize / 10)));
    if (targets.length === 0) break;

    const userIds = targets.map(row => row.userId);
    const result = await c.get("db").transaction(async tx => {
      await lockUserStates(tx, userIds);

      const deleted = await tx
        .delete(core_notifications)
        .where(and(where, inArray(core_notifications.userId, userIds)))
        .returning({
          activitySeq: core_notifications.activitySeq,
          archivedAt: core_notifications.archivedAt,
          readSeq: core_notifications.readSeq,
          userId: core_notifications.userId,
        });

      const deltas = new Map<number, number>();
      for (const item of deleted) {
        deltas.set(
          item.userId,
          (deltas.get(item.userId) ?? 0) - Number(isCounted(item)),
        );
      }

      return {
        count: deleted.length,
        updates: await applyUnreadDeltas(tx, deltas, reason),
      };
    });

    sendNotificationStates(c, result.updates);
    removed += result.count;
    if (result.count === 0) break;
  }

  return removed;
};
