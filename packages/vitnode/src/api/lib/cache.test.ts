import type { Context } from "hono";
import type { Redis } from "ioredis";

import { describe, expect, it, vi } from "vitest";

import { CacheModel } from "./cache";

const fakeContext = { get: () => undefined } as unknown as Context;
const LOCK_KEY = "vitnode:cache:__system__:lock:queue:process";

describe("CacheModel locks", () => {
  describe("without Redis", () => {
    const cache = new CacheModel(null, fakeContext);

    it("acquireLock returns true so cache-less deployments still proceed", async () => {
      await expect(cache.acquireLock("queue:process", 55)).resolves.toBe(true);
    });

    it("releaseLock is a no-op", async () => {
      await expect(cache.releaseLock("queue:process")).resolves.toBeUndefined();
    });
  });

  describe("with Redis", () => {
    it("acquires the lock with SET NX EX in the system namespace", async () => {
      const set = vi.fn().mockResolvedValue("OK");
      const cache = new CacheModel({ set } as unknown as Redis, fakeContext);

      await expect(cache.acquireLock("queue:process", 55)).resolves.toBe(true);
      expect(set).toHaveBeenCalledWith(LOCK_KEY, "1", "EX", 55, "NX");
    });

    it("returns false when the lock is already held", async () => {
      const set = vi.fn().mockResolvedValue(null);
      const cache = new CacheModel({ set } as unknown as Redis, fakeContext);

      await expect(cache.acquireLock("queue:process", 55)).resolves.toBe(false);
    });

    it("returns false when Redis errors, to skip rather than double-run", async () => {
      const set = vi.fn().mockRejectedValue(new Error("down"));
      const cache = new CacheModel({ set } as unknown as Redis, fakeContext);

      await expect(cache.acquireLock("queue:process", 55)).resolves.toBe(false);
    });

    it("releaseLock deletes the lock key", async () => {
      const del = vi.fn().mockResolvedValue(1);
      const cache = new CacheModel({ del } as unknown as Redis, fakeContext);

      await cache.releaseLock("queue:process");
      expect(del).toHaveBeenCalledWith(LOCK_KEY);
    });
  });
});
