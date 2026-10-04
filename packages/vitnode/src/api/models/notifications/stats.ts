import { and, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";

import {
  core_notification_deliveries,
  core_notification_events,
} from "@/database/notifications";

import type { NotificationsContext } from "./shared";

export const NOTIFICATION_STATS_RANGES = ["24h", "7d", "30d"] as const;
export type NotificationStatsRange = (typeof NOTIFICATION_STATS_RANGES)[number];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const RANGE_SPEC = {
  "24h": { count: 24, unit: "hour" },
  "30d": { count: 30, unit: "day" },
  "7d": { count: 7, unit: "day" },
} as const satisfies Record<
  NotificationStatsRange,
  { count: number; unit: "day" | "hour" }
>;

export interface NotificationStatsTotals {
  events: number;
  failed: number;
  sent: number;
  skipped: number;
}

export interface NotificationStatsPoint extends NotificationStatsTotals {
  key: string;
}

export interface NotificationStats {
  points: NotificationStatsPoint[];
  previous: NotificationStatsTotals;
  range: NotificationStatsRange;
  timeZone: string;
  totals: NotificationStatsTotals;
  unit: "day" | "hour";
}

export interface NotificationStatsRow {
  count: number;
  key: string;
  metric: keyof NotificationStatsTotals;
}

const localParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? "00";

  return {
    day: get("day"),
    hour: get("hour"),
    month: get("month"),
    year: get("year"),
  };
};

const dayKey = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);

export const buildNotificationStatsBuckets = ({
  now,
  range,
  timeZone,
}: {
  now: Date;
  range: NotificationStatsRange;
  timeZone: string;
}): { current: string[]; previous: string[] } => {
  const { count, unit } = RANGE_SPEC[range];
  const keys: string[] = [];

  if (unit === "day") {
    const today = localParts(now, timeZone);
    for (let offset = count * 2 - 1; offset >= 0; offset -= 1) {
      keys.push(
        dayKey(
          Number(today.year),
          Number(today.month) - 1,
          Number(today.day) - offset,
        ),
      );
    }
  } else {
    const seen = new Set<string>();
    for (let offset = count * 2 + 1; offset >= 0; offset -= 1) {
      const parts = localParts(
        new Date(now.getTime() - offset * HOUR),
        timeZone,
      );
      const key = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
    keys.splice(0, keys.length - count * 2);
  }

  return { current: keys.slice(count), previous: keys.slice(0, count) };
};

const emptyTotals = (): NotificationStatsTotals => ({
  events: 0,
  failed: 0,
  sent: 0,
  skipped: 0,
});

export const foldNotificationStats = (
  rows: NotificationStatsRow[],
  buckets: { current: string[]; previous: string[] },
): Pick<NotificationStats, "points" | "previous" | "totals"> => {
  const byKey = new Map<string, NotificationStatsTotals>();
  for (const row of rows) {
    const totals = byKey.get(row.key) ?? emptyTotals();
    totals[row.metric] += row.count;
    byKey.set(row.key, totals);
  }

  const sum = (keys: string[]) =>
    keys.reduce((acc, key) => {
      const bucket = byKey.get(key);
      if (!bucket) return acc;

      return {
        events: acc.events + bucket.events,
        failed: acc.failed + bucket.failed,
        sent: acc.sent + bucket.sent,
        skipped: acc.skipped + bucket.skipped,
      };
    }, emptyTotals());

  return {
    points: buckets.current.map(key => ({
      key,
      ...(byKey.get(key) ?? emptyTotals()),
    })),
    previous: sum(buckets.previous),
    totals: sum(buckets.current),
  };
};

export const getNotificationStats = async (
  c: NotificationsContext,
  {
    now = new Date(),
    range,
    timeZone,
  }: { now?: Date; range: NotificationStatsRange; timeZone: string },
): Promise<NotificationStats> => {
  const db = c.get("db");
  const { count, unit } = RANGE_SPEC[range];
  const buckets = buildNotificationStatsBuckets({ now, range, timeZone });
  const since = new Date(
    now.getTime() - (count * 2 + 2) * (unit === "day" ? DAY : HOUR),
  );
  const format = unit === "day" ? "YYYY-MM-DD" : 'YYYY-MM-DD"T"HH24';
  const bucketOf = (column: unknown) =>
    sql<string>`to_char(date_trunc(${unit}, (${column} AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}), ${format})`;
  const finishedAt = sql`coalesce(${core_notification_deliveries.sentAt}, ${core_notification_deliveries.updatedAt})`;

  const [deliveryRows, eventRows] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::integer`,
        key: bucketOf(finishedAt),
        status: core_notification_deliveries.status,
      })
      .from(core_notification_deliveries)
      .where(
        and(
          inArray(core_notification_deliveries.status, [
            "sent",
            "failed",
            "skipped",
          ]),
          ne(core_notification_deliveries.mode, "test"),
          or(
            gte(core_notification_deliveries.sentAt, since),
            and(
              isNull(core_notification_deliveries.sentAt),
              gte(core_notification_deliveries.updatedAt, since),
            ),
          ),
        ),
      )
      .groupBy(sql`2`, core_notification_deliveries.status),
    db
      .select({
        count: sql<number>`count(*)::integer`,
        key: bucketOf(core_notification_events.createdAt),
      })
      .from(core_notification_events)
      .where(gte(core_notification_events.createdAt, since))
      .groupBy(sql`2`),
  ]);

  const rows: NotificationStatsRow[] = [
    ...deliveryRows.map(row => ({
      count: row.count,
      key: row.key,
      metric:
        row.status === "sent"
          ? ("sent" as const)
          : row.status === "failed"
            ? ("failed" as const)
            : ("skipped" as const),
    })),
    ...eventRows.map(row => ({
      count: row.count,
      key: row.key,
      metric: "events" as const,
    })),
  ];

  return {
    ...foldNotificationStats(rows, buckets),
    range,
    timeZone,
    unit,
  };
};
