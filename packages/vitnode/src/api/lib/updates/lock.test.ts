import type { drizzle } from "drizzle-orm/postgres-js";

import { describe, expect, it } from "vitest";

import { core_update_lock } from "@/database/updates";
import { createMemoryDb } from "@/tests/memory-db";

import {
  acquireUpdateCheckLease,
  MANUAL_UPDATE_CHECK_COOLDOWN_MS,
  readUpdateCheckLock,
  releaseUpdateCheckLease,
  UPDATE_CHECK_LEASE_MS,
} from "./lock";

type Db = ReturnType<typeof drizzle>;

const T0 = new Date("2026-10-15T12:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

const memoryDb = () => {
  const memory = createMemoryDb();

  return { ...memory, db: memory.db as unknown as Db };
};

describe("acquireUpdateCheckLease", () => {
  it("lets only one of two racing checks take the lease", async () => {
    const { db } = memoryDb();

    const results = await Promise.all([
      acquireUpdateCheckLease(db, { manual: false, now: T0, owner: "a" }),
      acquireUpdateCheckLease(db, { manual: false, now: T0, owner: "b" }),
    ]);

    expect(results.filter(result => result.acquired)).toHaveLength(1);
    expect(results.find(result => !result.acquired)).toEqual({
      acquired: false,
      reason: "running",
      retryAfterSeconds: UPDATE_CHECK_LEASE_MS / 1000,
    });
  });

  it("takes over a lease whose holder died and let it expire", async () => {
    const { db } = memoryDb();
    await acquireUpdateCheckLease(db, { manual: false, now: T0, owner: "a" });

    await expect(
      acquireUpdateCheckLease(db, {
        manual: false,
        now: at(UPDATE_CHECK_LEASE_MS),
        owner: "b",
      }),
    ).resolves.toEqual({ acquired: true, owner: "b" });
  });

  it("is free again once the holder gives it back", async () => {
    const { db } = memoryDb();
    await acquireUpdateCheckLease(db, { manual: false, now: T0, owner: "a" });
    await releaseUpdateCheckLease(db, "a");

    await expect(
      acquireUpdateCheckLease(db, { manual: false, now: at(1000), owner: "b" }),
    ).resolves.toEqual({ acquired: true, owner: "b" });
  });

  it("keeps manual checks apart by the cooldown, but not the daily one", async () => {
    const { db } = memoryDb();
    await acquireUpdateCheckLease(db, { manual: true, now: T0, owner: "a" });
    await releaseUpdateCheckLease(db, "a");

    await expect(
      acquireUpdateCheckLease(db, {
        manual: true,
        now: at(30_000),
        owner: "b",
      }),
    ).resolves.toEqual({
      acquired: false,
      reason: "cooldown",
      retryAfterSeconds: MANUAL_UPDATE_CHECK_COOLDOWN_MS / 1000 - 30,
    });
    await expect(
      acquireUpdateCheckLease(db, {
        manual: false,
        now: at(30_000),
        owner: "c",
      }),
    ).resolves.toEqual({ acquired: true, owner: "c" });
  });

  it("allows a manual check again once the cooldown is over", async () => {
    const { db } = memoryDb();
    await acquireUpdateCheckLease(db, { manual: true, now: T0, owner: "a" });
    await releaseUpdateCheckLease(db, "a");

    await expect(
      acquireUpdateCheckLease(db, {
        manual: true,
        now: at(MANUAL_UPDATE_CHECK_COOLDOWN_MS),
        owner: "b",
      }),
    ).resolves.toEqual({ acquired: true, owner: "b" });
  });

  it("does not let the daily check reset the manual cooldown", async () => {
    const { db } = memoryDb();
    await acquireUpdateCheckLease(db, { manual: true, now: T0, owner: "a" });
    await releaseUpdateCheckLease(db, "a");
    await acquireUpdateCheckLease(db, {
      manual: false,
      now: at(10_000),
      owner: "b",
    });
    await releaseUpdateCheckLease(db, "b");

    await expect(readUpdateCheckLock(db, at(20_000))).resolves.toEqual({
      lastManualAt: T0,
      running: false,
    });
  });

  it("reports a running check to a manual request still in cooldown", async () => {
    const { db } = memoryDb();
    await acquireUpdateCheckLease(db, { manual: true, now: T0, owner: "a" });

    await expect(
      acquireUpdateCheckLease(db, { manual: true, now: at(1000), owner: "b" }),
    ).resolves.toMatchObject({ acquired: false, reason: "running" });
  });
});

describe("releaseUpdateCheckLease", () => {
  it("only lets the holder give the lease back", async () => {
    const { db } = memoryDb();
    await acquireUpdateCheckLease(db, { manual: false, now: T0, owner: "a" });

    await expect(releaseUpdateCheckLease(db, "b")).resolves.toBe(false);
    await expect(readUpdateCheckLock(db, at(1000))).resolves.toMatchObject({
      running: true,
    });
    await expect(releaseUpdateCheckLease(db, "a")).resolves.toBe(true);
    await expect(readUpdateCheckLock(db, at(1000))).resolves.toMatchObject({
      running: false,
    });
  });

  it("cannot give back a lease another instance took over after expiry", async () => {
    const { db, rows } = memoryDb();
    await acquireUpdateCheckLease(db, { manual: false, now: T0, owner: "a" });
    await acquireUpdateCheckLease(db, {
      manual: false,
      now: at(UPDATE_CHECK_LEASE_MS + 1),
      owner: "b",
    });

    await expect(releaseUpdateCheckLease(db, "a")).resolves.toBe(false);
    expect(rows(core_update_lock)).toMatchObject([{ owner: "b" }]);
  });
});
