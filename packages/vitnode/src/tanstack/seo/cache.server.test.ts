import { PAGE_CACHE_CLOCK_SKEW_MS } from "@vitnode/api/page-cache/store.server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SeoSitemapCache } from "./cache.server";

import { seoCachedState } from "./cache.server";

const NOW = new Date("2026-01-01T00:00:00Z").getTime();
const STARTED = NOW - 60_000;

const cacheWith = ({
  bypassUntil = 0,
  hard = 0,
  soft = 0,
}: {
  bypassUntil?: number;
  hard?: number;
  soft?: number;
}): SeoSitemapCache => ({
  bypassUntil: () => bypassUntil,
  delete: async () => {},
  ensure: () => {},
  get: async () => await Promise.resolve(null),
  invalidatedAt: async (_, mode) =>
    await Promise.resolve(mode === "hard" ? hard : soft),
  set: async () => {},
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("seoCachedState", () => {
  it.each<[string, Parameters<typeof cacheWith>[0], string]>([
    ["nothing invalidated", {}, "fresh"],
    [
      "invalidated long before the read",
      { hard: STARTED - 60_000, soft: STARTED - 60_000 },
      "fresh",
    ],
    ["soft after the read", { soft: STARTED + 1 }, "stale"],
    ["hard after the read", { hard: STARTED + 1 }, "invalid"],
    // A hard invalidation inside the skew allowance may have happened after the
    // read by another server's clock, so the read is never trusted.
    [
      "hard just inside the skew window",
      { hard: STARTED - PAGE_CACHE_CLOCK_SKEW_MS },
      "invalid",
    ],
    [
      "hard just outside the skew window",
      { hard: STARTED - PAGE_CACHE_CLOCK_SKEW_MS - 1 },
      "fresh",
    ],
    [
      "soft just inside the skew window",
      { soft: STARTED - PAGE_CACHE_CLOCK_SKEW_MS },
      "stale",
    ],
    [
      "hard wins over soft",
      { hard: STARTED + 1, soft: STARTED + 1 },
      "invalid",
    ],
    [
      "a failed invalidation still bypassing the cache",
      { bypassUntil: NOW + 1 },
      "invalid",
    ],
  ])("%s → %s", async (_, stamps, state) => {
    expect(await seoCachedState(cacheWith(stamps), ["tag"], STARTED)).toBe(
      state,
    );
  });

  it("is fresh for data that depends on no tag", async () => {
    expect(await seoCachedState(cacheWith({ hard: NOW }), [], STARTED)).toBe(
      "fresh",
    );
  });
});
