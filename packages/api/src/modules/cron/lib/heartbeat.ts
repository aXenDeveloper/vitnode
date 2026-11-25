import type { drizzle } from "drizzle-orm/postgres-js";

import { gte, lt, min, sql } from "drizzle-orm";

import { core_cron_heartbeats } from "@/database/cron";

export const HEARTBEAT_SLOT_MS = 30 * 60 * 1000;
export const HEARTBEAT_SLOTS = 48;
const HEARTBEAT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CURRENT_SLOT_GRACE_MS = 2 * 60 * 1000;

export type HeartbeatSlotState = "missed" | "none" | "ran";

type Database = ReturnType<typeof drizzle>;

export const heartbeatSlotOf = (date: Date): Date =>
  new Date(Math.floor(date.getTime() / HEARTBEAT_SLOT_MS) * HEARTBEAT_SLOT_MS);

export const recordCronHeartbeat = async (db: Database, now: Date) =>
  await db
    .insert(core_cron_heartbeats)
    .values({ slot: heartbeatSlotOf(now), ticks: 1 })
    .onConflictDoUpdate({
      set: { ticks: sql`${core_cron_heartbeats.ticks} + 1` },
      target: core_cron_heartbeats.slot,
    });

export const pruneCronHeartbeats = async (db: Database, now: Date) =>
  await db
    .delete(core_cron_heartbeats)
    .where(
      lt(
        core_cron_heartbeats.slot,
        new Date(now.getTime() - HEARTBEAT_RETENTION_MS),
      ),
    );

/**
 * The scheduler's last {@link HEARTBEAT_SLOTS} half-hour slots, oldest first:
 * `ran` when a tick landed in it, `missed` when none did, and `none` before
 * the first recorded tick or for a current slot that has barely started.
 */
export const heartbeatSlotStates = ({
  firstSlot,
  now,
  ticked,
}: {
  firstSlot: Date | null;
  now: Date;
  ticked: Set<number>;
}): { slot: Date; state: HeartbeatSlotState }[] => {
  const current = heartbeatSlotOf(now).getTime();

  return Array.from({ length: HEARTBEAT_SLOTS }, (_, index) => {
    const start = current - (HEARTBEAT_SLOTS - 1 - index) * HEARTBEAT_SLOT_MS;
    const slot = new Date(start);
    if (ticked.has(start)) return { slot, state: "ran" };
    if (firstSlot === null || start < firstSlot.getTime()) {
      return { slot, state: "none" };
    }
    if (start === current && now.getTime() - start < CURRENT_SLOT_GRACE_MS) {
      return { slot, state: "none" };
    }

    return { slot, state: "missed" };
  });
};

export const loadCronHeartbeat = async (db: Database, now: Date) => {
  const since = new Date(
    heartbeatSlotOf(now).getTime() - (HEARTBEAT_SLOTS - 1) * HEARTBEAT_SLOT_MS,
  );
  const [rows, [first]] = await Promise.all([
    db
      .select({ slot: core_cron_heartbeats.slot })
      .from(core_cron_heartbeats)
      .where(gte(core_cron_heartbeats.slot, since)),
    db
      .select({ slot: min(core_cron_heartbeats.slot) })
      .from(core_cron_heartbeats),
  ]);

  return heartbeatSlotStates({
    firstSlot: first?.slot ?? null,
    now,
    ticked: new Set(rows.map(row => row.slot.getTime())),
  });
};
