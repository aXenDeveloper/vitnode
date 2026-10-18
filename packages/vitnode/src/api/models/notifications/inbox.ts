import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

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
  notificationEventColumns,
  presentNotification,
  resolveEvent,
} from "./render";
import { sendNotificationStates } from "./shared";

type StateUpdate = NotificationStateMessage & { userId: number };

export const UNREAD_SQL = sql`${core_notifications.archivedAt} IS NULL AND ${core_notifications.readSeq} < ${core_notifications.activitySeq}`;

export interface NotificationListItem {
  activitySeq: number;
  actorCount: number;
  actors: NotificationActor[];
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

// `lastActivityAt` is a microsecond `timestamp`, so the cursor carries the
// database's own `::text` of it: a millisecond `Date` would round the boundary
// down and skip every row in the lost microseconds.
const TIMESTAMP_TEXT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;
const cursorSchema = z.object({
  id: z.number().int(),
  ts: z.string().regex(TIMESTAMP_TEXT),
});

const encodeCursor = (cursor: z.infer<typeof cursorSchema>): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

const parseCursorJson = (raw: string): unknown => {
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const decodeCursor = (raw: string) => {
  const cursor = cursorSchema.safeParse(parseCursorJson(raw));
  if (!cursor.success) {
    throw new HTTPException(400, { message: "Invalid pagination cursor." });
  }

  // A row comparison, unlike the equivalent `a < x OR (a = x AND id < y)`, is
  // something Postgres can seek the `(userId, lastActivityAt, id)` index with.
  return sql`(${core_notifications.lastActivityAt}, ${core_notifications.id}) < (${cursor.data.ts}::timestamp, ${cursor.data.id}::bigint)`;
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
  const after = cursor ? decodeCursor(cursor) : undefined;

  const rows = await c
    .get("db")
    .select({
      cursorAt: sql<string>`${core_notifications.lastActivityAt}::text`,
      event: notificationEventColumns,
      item: core_notifications,
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
        after,
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
        ? encodeCursor({ id: last.item.id, ts: last.cursorAt })
        : null,
  };
};

type ItemRow = typeof core_notifications.$inferSelect;

const USERS_PER_RECONCILE_BATCH = 200;
const ITEMS_PER_REMOVE_BATCH = 500;

const isCounted = (
  item: Pick<ItemRow, "activitySeq" | "archivedAt" | "readSeq">,
) => item.archivedAt === null && item.readSeq < item.activitySeq;

const changeItemUnderUserLock = async (
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
  const { state, update } = await c.get("db").transaction(async tx => {
    await lockUserStates(tx, [userId]);

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

    return { state: update, update };
  });

  if (update) sendNotificationStates(c, [update]);

  return { revision: state.revision, unread: state.unread };
};

export const markNotificationRead = async (
  c: NotificationsContext,
  args: { notificationId: number; throughSeq?: number; userId: number },
): Promise<NotificationState> =>
  await changeItemUnderUserLock(c, {
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
  await changeItemUnderUserLock(c, {
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
  await changeItemUnderUserLock(c, {
    change: (item, now) => (item.archivedAt ? null : { archivedAt: now }),
    notificationId: args.notificationId,
    reason: "archived",
    userId: args.userId,
  });

export const markAllNotificationsRead = async (
  c: NotificationsContext,
  { category, userId }: { category?: string; userId: number },
): Promise<NotificationState & { marked: number }> => {
  const { marked, state, update } = await c.get("db").transaction(async tx => {
    await lockUserStates(tx, [userId]);
    const now = new Date();

    const markedItems = await tx
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

    if (markedItems.length === 0) {
      return {
        marked: 0,
        state: await getNotificationState(tx, userId),
        update: null,
      };
    }

    const [update] = await applyUnreadDeltas(
      tx,
      new Map([[userId, -markedItems.length]]),
      "read_all",
    );

    return { marked: markedItems.length, state: update, update };
  });

  if (update) sendNotificationStates(c, [update]);

  return { marked, revision: state.revision, unread: state.unread };
};

export const reconcileNotificationCounts = async (
  c: NotificationsContext,
  userIds: number[],
): Promise<{ checked: number; corrected: number }> => {
  let corrected = 0;
  const updates: StateUpdate[] = [];

  for (
    let index = 0;
    index < userIds.length;
    index += USERS_PER_RECONCILE_BATCH
  ) {
    const chunk = userIds.slice(index, index + USERS_PER_RECONCILE_BATCH);
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

export const removeNotificationItems = async (
  c: NotificationsContext,
  { where }: { where: ReturnType<typeof and> },
): Promise<number> => {
  let removed = 0;

  for (;;) {
    // Item ids in `lastActivityAt` order, so the retention sweep walks the
    // `last_activity` index a page at a time.
    const targets = await c
      .get("db")
      .select({ id: core_notifications.id, userId: core_notifications.userId })
      .from(core_notifications)
      .where(where)
      .orderBy(asc(core_notifications.lastActivityAt))
      .limit(ITEMS_PER_REMOVE_BATCH);
    if (targets.length === 0) break;

    const batch = await c.get("db").transaction(async tx => {
      await lockUserStates(
        tx,
        targets.map(row => row.userId),
      );

      // `where` again, under the lock: an item that gained activity since the
      // read above may no longer match.
      const deleted = await tx
        .delete(core_notifications)
        .where(
          and(
            where,
            inArray(
              core_notifications.id,
              targets.map(row => row.id),
            ),
          ),
        )
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
        updates: await applyUnreadDeltas(tx, deltas, "removed"),
      };
    });

    sendNotificationStates(c, batch.updates);
    removed += batch.count;
    if (targets.length < ITEMS_PER_REMOVE_BATCH || batch.count === 0) break;
  }

  return removed;
};
