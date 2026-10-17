import type { drizzle } from "drizzle-orm/postgres-js";

import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { core_update_lock } from "@/database/updates";

type Db = ReturnType<typeof drizzle>;

const LOCK_NAME = "check";

/** Longer than a check can take: every source has a 10 s timeout and they run four at a time. */
export const UPDATE_CHECK_LEASE_MS = 5 * 60_000;

export const MANUAL_UPDATE_CHECK_COOLDOWN_MS = 2 * 60_000;

export type UpdateCheckLease =
  | { acquired: false; reason: "cooldown"; retryAfterSeconds: number }
  | { acquired: false; reason: "running"; retryAfterSeconds: number }
  | { acquired: true; owner: string };

const secondsUntil = (date: Date | null, now: Date): number =>
  date === null
    ? 1
    : Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1000));

/**
 * One statement, so two instances racing for the lease cannot both win: the
 * insert creates the row, and the conflict branch only takes it over when no
 * one holds it or the holder's lease ran out. A manual check also has to be
 * past the cooldown, and stamps it in the same statement.
 */
export const acquireUpdateCheckLease = async (
  db: Db,
  {
    cooldownMs = MANUAL_UPDATE_CHECK_COOLDOWN_MS,
    leaseMs = UPDATE_CHECK_LEASE_MS,
    manual,
    now = new Date(),
    owner = randomUUID(),
  }: {
    cooldownMs?: number;
    leaseMs?: number;
    manual: boolean;
    now?: Date;
    owner?: string;
  },
): Promise<UpdateCheckLease> => {
  const expiresAt = new Date(now.getTime() + leaseMs);
  const free = or(
    isNull(core_update_lock.owner),
    isNull(core_update_lock.expiresAt),
    lte(core_update_lock.expiresAt, now),
  );
  const cooledDown = or(
    isNull(core_update_lock.lastManualAt),
    lte(core_update_lock.lastManualAt, new Date(now.getTime() - cooldownMs)),
  );

  const [taken] = await db
    .insert(core_update_lock)
    .values({
      expiresAt,
      lastManualAt: manual ? now : null,
      name: LOCK_NAME,
      owner,
    })
    .onConflictDoUpdate({
      set: {
        expiresAt,
        lastManualAt: manual ? now : sql`${core_update_lock.lastManualAt}`,
        owner,
      },
      setWhere: manual ? and(free, cooledDown) : free,
      target: core_update_lock.name,
    })
    .returning({ owner: core_update_lock.owner });

  if (taken?.owner === owner) return { acquired: true, owner };

  const [row] = await db
    .select()
    .from(core_update_lock)
    .where(eq(core_update_lock.name, LOCK_NAME));

  if (
    row?.owner !== null &&
    row?.owner !== undefined &&
    row.expiresAt !== null &&
    row.expiresAt > now
  ) {
    return {
      acquired: false,
      reason: "running",
      retryAfterSeconds: secondsUntil(row.expiresAt, now),
    };
  }

  return {
    acquired: false,
    reason: "cooldown",
    retryAfterSeconds: secondsUntil(
      row?.lastManualAt
        ? new Date(row.lastManualAt.getTime() + cooldownMs)
        : null,
      now,
    ),
  };
};

/** Only the instance that holds the lease can give it back. */
export const releaseUpdateCheckLease = async (
  db: Db,
  owner: string,
): Promise<boolean> => {
  const released = await db
    .update(core_update_lock)
    .set({ expiresAt: null, owner: null })
    .where(
      and(
        eq(core_update_lock.name, LOCK_NAME),
        eq(core_update_lock.owner, owner),
      ),
    )
    .returning({ name: core_update_lock.name });

  return released.length > 0;
};

export interface UpdateCheckLockState {
  lastManualAt: Date | null;
  running: boolean;
}

export const readUpdateCheckLock = async (
  db: Db,
  now: Date = new Date(),
): Promise<UpdateCheckLockState> => {
  const [row] = await db
    .select()
    .from(core_update_lock)
    .where(eq(core_update_lock.name, LOCK_NAME));

  return {
    lastManualAt: row?.lastManualAt ?? null,
    running:
      row?.owner !== null &&
      row?.owner !== undefined &&
      row.expiresAt !== null &&
      row.expiresAt > now,
  };
};
