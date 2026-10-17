import type { drizzle } from "drizzle-orm/postgres-js";

import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { core_update_lock } from "@/database/updates";

type Db = ReturnType<typeof drizzle>;

export type UpdateCheckTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const LOCK_NAME = "check";

const ADVISORY_KEY = `core_update_lock:${LOCK_NAME}`;

export const UPDATE_CHECK_LEASE_MS = 5 * 60_000;

export const UPDATE_CHECK_RENEW_INTERVAL_MS = 60_000;

export const MANUAL_UPDATE_CHECK_COOLDOWN_MS = 2 * 60_000;

export class UpdateCheckLeaseLostError extends Error {
  constructor(options?: ErrorOptions) {
    super("This instance no longer holds the update check lease", options);
    this.name = "UpdateCheckLeaseLostError";
  }
}

export type UpdateCheckLease =
  | { acquired: false; reason: "cooldown"; retryAfterSeconds: number }
  | { acquired: false; reason: "running"; retryAfterSeconds: number }
  | { acquired: true; owner: string };

export interface UpdateCheckLeaseRenewal {
  status: "lost" | "renewed";
}

const databaseNow = () =>
  sql`timezone('utc', clock_timestamp())`.mapWith(core_update_lock.expiresAt);

const secondsUntil = (date: Date, now: Date): number =>
  Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1000));

const lockLease = async (tx: UpdateCheckTx, { create = false } = {}) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${ADVISORY_KEY}))`,
  );
  if (create) {
    await tx
      .insert(core_update_lock)
      .values({ name: LOCK_NAME })
      .onConflictDoNothing({ target: core_update_lock.name });
  }

  const [row] = await tx
    .select({
      expiresAt: core_update_lock.expiresAt,
      lastManualAt: core_update_lock.lastManualAt,
      now: databaseNow(),
      owner: core_update_lock.owner,
    })
    .from(core_update_lock)
    .where(eq(core_update_lock.name, LOCK_NAME))
    .for("update");

  return row ?? null;
};

type LeaseRow = Awaited<ReturnType<typeof lockLease>>;

type HeldLeaseRow = NonNullable<LeaseRow> & { expiresAt: Date; owner: string };

const isHeld = (row: LeaseRow): row is HeldLeaseRow =>
  row !== null &&
  row.owner !== null &&
  row.expiresAt !== null &&
  row.expiresAt > row.now;

const isHeldBy = (row: LeaseRow, owner: string): boolean =>
  isHeld(row) && row.owner === owner;

/**
 * Two instances racing for the lease cannot both win: the lease lock orders
 * them, and the second sees the first one's lease. A manual check also has to
 * be past the cooldown, and stamps it in the same transaction.
 */
export const acquireUpdateCheckLease = async (
  db: Db,
  {
    cooldownMs = MANUAL_UPDATE_CHECK_COOLDOWN_MS,
    leaseMs = UPDATE_CHECK_LEASE_MS,
    manual,
    owner = randomUUID(),
  }: {
    cooldownMs?: number;
    leaseMs?: number;
    manual: boolean;
    owner?: string;
  },
): Promise<UpdateCheckLease> =>
  await db.transaction(async tx => {
    const row = await lockLease(tx, { create: true });
    if (row === null) throw new Error("The update check lease row is missing");
    const { now } = row;

    if (isHeld(row)) {
      return {
        acquired: false,
        reason: "running",
        retryAfterSeconds: secondsUntil(row.expiresAt, now),
      };
    }

    const cooledDownAt =
      row.lastManualAt === null
        ? null
        : new Date(row.lastManualAt.getTime() + cooldownMs);
    if (manual && cooledDownAt !== null && cooledDownAt > now) {
      return {
        acquired: false,
        reason: "cooldown",
        retryAfterSeconds: secondsUntil(cooledDownAt, now),
      };
    }

    await tx
      .update(core_update_lock)
      .set({
        expiresAt: new Date(now.getTime() + leaseMs),
        owner,
        ...(manual ? { lastManualAt: now } : {}),
      })
      .where(eq(core_update_lock.name, LOCK_NAME));

    return { acquired: true, owner };
  });

export const renewUpdateCheckLease = async (
  db: Db,
  owner: string,
): Promise<UpdateCheckLeaseRenewal> =>
  await db.transaction(async tx => {
    const row = await lockLease(tx);
    if (!isHeld(row) || row.owner !== owner) return { status: "lost" };

    await tx
      .update(core_update_lock)
      .set({ expiresAt: new Date(row.now.getTime() + UPDATE_CHECK_LEASE_MS) })
      .where(
        and(
          eq(core_update_lock.name, LOCK_NAME),
          eq(core_update_lock.owner, owner),
        ),
      );

    return { status: "renewed" };
  });

export const withUpdateCheckLease = async <T>(
  db: Db,
  owner: string,
  write: (tx: UpdateCheckTx) => Promise<T>,
): Promise<T> =>
  await db.transaction(async tx => {
    const row = await lockLease(tx);
    if (!isHeldBy(row, owner)) throw new UpdateCheckLeaseLostError();

    return await write(tx);
  });

/** Only the instance that holds the lease can give it back. */
export const releaseUpdateCheckLease = async (
  db: Db,
  owner: string,
): Promise<boolean> =>
  await db.transaction(async tx => {
    const row = await lockLease(tx);
    if (row?.owner !== owner) return false;

    await tx
      .update(core_update_lock)
      .set({ expiresAt: null, owner: null })
      .where(
        and(
          eq(core_update_lock.name, LOCK_NAME),
          eq(core_update_lock.owner, owner),
        ),
      );

    return true;
  });

export interface UpdateCheckLockState {
  lastManualAt: Date | null;
  running: boolean;
}

export const readUpdateCheckLock = async (
  db: Db,
): Promise<UpdateCheckLockState> => {
  const [row] = await db
    .select({
      expiresAt: core_update_lock.expiresAt,
      lastManualAt: core_update_lock.lastManualAt,
      now: databaseNow(),
      owner: core_update_lock.owner,
    })
    .from(core_update_lock)
    .where(eq(core_update_lock.name, LOCK_NAME));

  return {
    lastManualAt: row?.lastManualAt ?? null,
    running: isHeld(row ?? null),
  };
};
