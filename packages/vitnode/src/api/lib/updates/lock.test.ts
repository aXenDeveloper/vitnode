import type { drizzle } from "drizzle-orm/postgres-js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { core_update_lock, core_update_sources } from "@/database/updates";
import { createMemoryDb } from "@/tests/memory-db";

import {
  acquireUpdateCheckLease,
  MANUAL_UPDATE_CHECK_COOLDOWN_MS,
  readUpdateCheckLock,
  releaseUpdateCheckLease,
  renewUpdateCheckLease,
  UPDATE_CHECK_LEASE_MS,
  UpdateCheckLeaseLostError,
  withUpdateCheckLease,
} from "./lock";

type Db = ReturnType<typeof drizzle>;

const T0 = new Date("2026-10-15T12:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

/** The memory database reads `clock_timestamp()` off `Date`, so this moves its clock. */
const clockAt = (ms: number) => {
  vi.setSystemTime(at(ms));
};

const memoryDb = () => {
  const memory = createMemoryDb();

  return { ...memory, db: memory.db as unknown as Db };
};

const take = async (db: Db, owner: string, manual = false) =>
  await acquireUpdateCheckLease(db, { manual, owner });

beforeEach(() => {
  vi.useFakeTimers({ now: T0, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("acquireUpdateCheckLease", () => {
  it("lets only one of two racing checks take the lease", async () => {
    const { db } = memoryDb();

    const results = await Promise.all([take(db, "a"), take(db, "b")]);

    expect(results.filter(result => result.acquired)).toHaveLength(1);
    expect(results.find(result => !result.acquired)).toEqual({
      acquired: false,
      reason: "running",
      retryAfterSeconds: UPDATE_CHECK_LEASE_MS / 1000,
    });
  });

  it("takes over a lease whose holder died and let it expire", async () => {
    const { db } = memoryDb();
    await take(db, "a");

    clockAt(UPDATE_CHECK_LEASE_MS - 1);
    await expect(take(db, "b")).resolves.toMatchObject({ acquired: false });
    clockAt(UPDATE_CHECK_LEASE_MS);
    await expect(take(db, "b")).resolves.toEqual({
      acquired: true,
      owner: "b",
    });
  });

  it("is free again once the holder gives it back", async () => {
    const { db } = memoryDb();
    await take(db, "a");
    await releaseUpdateCheckLease(db, "a");

    clockAt(1000);
    await expect(take(db, "b")).resolves.toEqual({
      acquired: true,
      owner: "b",
    });
  });

  it("keeps manual checks apart by the cooldown, but not the daily one", async () => {
    const { db } = memoryDb();
    await take(db, "a", true);
    await releaseUpdateCheckLease(db, "a");

    clockAt(30_000);
    await expect(take(db, "b", true)).resolves.toEqual({
      acquired: false,
      reason: "cooldown",
      retryAfterSeconds: MANUAL_UPDATE_CHECK_COOLDOWN_MS / 1000 - 30,
    });
    await expect(take(db, "c")).resolves.toEqual({
      acquired: true,
      owner: "c",
    });
  });

  it("allows a manual check again once the cooldown is over", async () => {
    const { db } = memoryDb();
    await take(db, "a", true);
    await releaseUpdateCheckLease(db, "a");

    clockAt(MANUAL_UPDATE_CHECK_COOLDOWN_MS);
    await expect(take(db, "b", true)).resolves.toEqual({
      acquired: true,
      owner: "b",
    });
  });

  it("does not let the daily check reset the manual cooldown", async () => {
    const { db } = memoryDb();
    await take(db, "a", true);
    await releaseUpdateCheckLease(db, "a");
    clockAt(10_000);
    await take(db, "b");
    await releaseUpdateCheckLease(db, "b");

    clockAt(20_000);
    await expect(readUpdateCheckLock(db)).resolves.toEqual({
      lastManualAt: T0,
      running: false,
    });
  });

  it("reports a running check to a manual request still in cooldown", async () => {
    const { db } = memoryDb();
    await take(db, "a", true);

    clockAt(1000);
    await expect(take(db, "b", true)).resolves.toMatchObject({
      acquired: false,
      reason: "running",
    });
  });
});

describe("renewUpdateCheckLease", () => {
  it("pushes the holder's lease out from the database's now", async () => {
    const { db } = memoryDb();
    await take(db, "a");

    clockAt(UPDATE_CHECK_LEASE_MS - 1000);
    await expect(renewUpdateCheckLease(db, "a")).resolves.toEqual({
      expiresAt: at(2 * UPDATE_CHECK_LEASE_MS - 1000),
      status: "renewed",
    });

    // Past the first lease's end, still held thanks to the renewal.
    clockAt(UPDATE_CHECK_LEASE_MS + 1000);
    await expect(take(db, "b")).resolves.toMatchObject({
      acquired: false,
      reason: "running",
    });
  });

  it("never renews someone else's lease", async () => {
    const { db, rows } = memoryDb();
    await take(db, "a");

    await expect(renewUpdateCheckLease(db, "b")).resolves.toEqual({
      status: "lost",
    });
    expect(rows(core_update_lock)).toMatchObject([
      { expiresAt: at(UPDATE_CHECK_LEASE_MS), owner: "a" },
    ]);
  });

  it("refuses an owner whose lease ran out, even before anyone took it over", async () => {
    const { db, rows } = memoryDb();
    await take(db, "a");

    clockAt(UPDATE_CHECK_LEASE_MS);
    await expect(renewUpdateCheckLease(db, "a")).resolves.toEqual({
      status: "lost",
    });
    expect(rows(core_update_lock)).toMatchObject([
      { expiresAt: at(UPDATE_CHECK_LEASE_MS), owner: "a" },
    ]);
  });
});

describe("withUpdateCheckLease", () => {
  const writeSource = async (db: Db, owner: string) =>
    await withUpdateCheckLease(db, owner, async tx => {
      await tx.insert(core_update_sources).values({
        lastAttemptAt: T0,
        url: "https://acme.example.com/updates.json",
      });

      return "written";
    });

  it("runs the write for the holder", async () => {
    const { db, rows } = memoryDb();
    await take(db, "a");

    await expect(writeSource(db, "a")).resolves.toBe("written");
    expect(rows(core_update_sources)).toHaveLength(1);
  });

  it.each([
    ["nobody holds the lease", async () => {}],
    [
      "another instance holds it",
      async (db: Db) => {
        await take(db, "b");
      },
    ],
    [
      "its own lease ran out",
      async (db: Db) => {
        await take(db, "a");
        clockAt(UPDATE_CHECK_LEASE_MS);
      },
    ],
    [
      "another instance took it over after expiry",
      async (db: Db) => {
        await take(db, "a");
        clockAt(UPDATE_CHECK_LEASE_MS);
        await take(db, "b");
      },
    ],
  ])("writes nothing when %s", async (_, prepare) => {
    const { db, rows } = memoryDb();
    await prepare(db);
    const write = vi.fn();

    await expect(withUpdateCheckLease(db, "a", write)).rejects.toBeInstanceOf(
      UpdateCheckLeaseLostError,
    );
    expect(write).not.toHaveBeenCalled();
    expect(rows(core_update_sources)).toEqual([]);
  });
});

describe("releaseUpdateCheckLease", () => {
  it("only lets the holder give the lease back", async () => {
    const { db } = memoryDb();
    await take(db, "a");
    clockAt(1000);

    await expect(releaseUpdateCheckLease(db, "b")).resolves.toBe(false);
    await expect(readUpdateCheckLock(db)).resolves.toMatchObject({
      running: true,
    });
    await expect(releaseUpdateCheckLease(db, "a")).resolves.toBe(true);
    await expect(readUpdateCheckLock(db)).resolves.toMatchObject({
      running: false,
    });
  });

  it("cannot give back a lease another instance took over after expiry", async () => {
    const { db, rows } = memoryDb();
    await take(db, "a");
    clockAt(UPDATE_CHECK_LEASE_MS + 1);
    await take(db, "b");

    await expect(releaseUpdateCheckLease(db, "a")).resolves.toBe(false);
    expect(rows(core_update_lock)).toMatchObject([{ owner: "b" }]);
  });
});

describe("readUpdateCheckLock", () => {
  it("stops reporting a check as running once its lease ran out", async () => {
    const { db } = memoryDb();
    await take(db, "a");

    clockAt(UPDATE_CHECK_LEASE_MS - 1);
    await expect(readUpdateCheckLock(db)).resolves.toMatchObject({
      running: true,
    });
    clockAt(UPDATE_CHECK_LEASE_MS);
    await expect(readUpdateCheckLock(db)).resolves.toMatchObject({
      running: false,
    });
  });
});
