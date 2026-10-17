import type { drizzle } from "drizzle-orm/postgres-js";

import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { core_update_lock } from "@/database/updates";

type Db = ReturnType<typeof drizzle>;

export type UpdateCheckTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const LOCK_NAME = "check";

const ADVISORY_KEY = `core_update_lock:${LOCK_NAME}`;

/** Every source has a 10 s timeout and they run four at a time; the heartbeat keeps a longer check alive. */
export const UPDATE_CHECK_LEASE_MS = 5 * 60_000;

export const UPDATE_CHECK_RENEW_INTERVAL_MS = 60_000;

export const MANUAL_UPDATE_CHECK_COOLDOWN_MS = 2 * 60_000;

/** This run can no longer prove it holds the lease, so it must stop and write nothing more. */
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

export type UpdateCheckLeaseRenewal =
  | { expiresAt: Date; status: "renewed" }
  | { status: "lost" };

/**
 * The database's clock, in UTC like every stored timestamp. Every lease
 * decision reads it, so API instances whose own clocks disagree still agree on
 * who holds the lease and when it runs out.
 */
const databaseNow = () =>
  sql`timezone('utc', clock_timestamp())`.mapWith(core_update_lock.expiresAt);

const secondsUntil = (date: Date | null, now: Date): number =>
  date === null
    ? 1
    : Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1000));

/**
 * The one locking model every lease transaction follows - taking, renewing,
 * giving back, and every write a check makes. The advisory lock serialises
 * them, including the first insert when no row exists yet; the row lock also
 * holds off a writer that does not take the advisory lock, such as an instance
 * still running the previous release during a rolling deploy. Both are held
 * until the transaction commits.
 */
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

const isHeld = (row: LeaseRow): boolean =>
  row?.owner !== null &&
  row?.owner !== undefined &&
  row.expiresAt !== null &&
  row.expiresAt > row.now;

const isHeldBy = (row: LeaseRow, owner: string): boolean =>
  isHeld(row) && row?.owner === owner;

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

/**
 * Pushes the lease out by another `leaseMs` from now - only for the owner, and
 * only while its lease has not run out. An owner whose lease expired gets
 * `lost`, even when nobody took it over yet: it cannot know what happened in
 * between.
 */
export const renewUpdateCheckLease = async (
  db: Db,
  owner: string,
  { leaseMs = UPDATE_CHECK_LEASE_MS }: { leaseMs?: number } = {},
): Promise<UpdateCheckLeaseRenewal> =>
  await db.transaction(async tx => {
    const row = await lockLease(tx);
    if (row === null || !isHeldBy(row, owner)) return { status: "lost" };

    const expiresAt = new Date(row.now.getTime() + leaseMs);
    await tx
      .update(core_update_lock)
      .set({ expiresAt })
      .where(
        and(
          eq(core_update_lock.name, LOCK_NAME),
          eq(core_update_lock.owner, owner),
        ),
      );

    return { expiresAt, status: "renewed" };
  });

/**
 * The write fence. Runs `write` in one short transaction that first takes the
 * lease lock and confirms `owner` still holds an unexpired lease, by the
 * database's clock; otherwise it throws {@link UpdateCheckLeaseLostError} and
 * writes nothing. Because taking the lease needs the same lock, no other
 * instance can take it over between the check and the commit. Never call it
 * around a network request - the lock is held until `write` returns.
 */
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
