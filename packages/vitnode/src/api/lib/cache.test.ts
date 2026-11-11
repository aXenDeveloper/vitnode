import type { Context } from "hono";

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createTestCacheClient } from "@/tests/cache";

import type { CacheClient } from "./cache";

import { CacheModel, cacheStore, domainCacheOf, findCacheStore } from "./cache";
import { CacheEntryValidationError, defineCacheEntry } from "./cache-entry";
import { MEMORY_CACHE_MAX_TTL_SECONDS, MemoryCacheStore } from "./cache-memory";

const SECRET = "s3cret-token";

const contextOf = (plugin?: string) =>
  ({
    get: (key: string) =>
      key === "plugin" && plugin ? { id: plugin } : undefined,
  }) as unknown as Context;

const statsEntry = defineCacheEntry({
  pluginId: "@vitnode/forum",
  name: "stats",
  version: 1,
  key: (forumId: number | string) => [forumId],
  schema: z.object({ topics: z.number().int() }),
  ttlSeconds: 60,
});

const backends = [
  [
    "Redis",
    () => {
      const client = createTestCacheClient();

      return {
        cache: (plugin?: string) => new CacheModel(client, contextOf(plugin)),
        raw: async (key: string) => await client.get(key),
        write: async (key: string, value: string) => {
          await client.set(key, value);
        },
      };
    },
  ],
  [
    "memory",
    () => {
      const memory = new MemoryCacheStore();

      return {
        cache: (plugin?: string) =>
          new CacheModel(null, contextOf(plugin), memory),
        raw: async (key: string) => await Promise.resolve(memory.get(key)),
        write: async (key: string, value: string) => {
          memory.set(key, value, 60);
          await Promise.resolve();
        },
      };
    },
  ],
] as const;

describe.each(backends)("CacheModel.entry (%s)", (_, setup) => {
  it("stores, reads back and deletes a value", async () => {
    const { cache } = setup();
    const entry = cache().entry(statsEntry, 1);

    await entry.set({ topics: 3 });
    expect(await entry.get()).toEqual({ topics: 3 });

    await entry.delete();
    expect(await entry.get()).toBeUndefined();
  });

  it.each([null, false, 0, ""])("treats a stored %j as a hit", async value => {
    const { cache } = setup();
    const definition = defineCacheEntry({
      pluginId: "@vitnode/forum",
      name: "falsy",
      version: 1,
      schema: z.union([z.null(), z.boolean(), z.number(), z.string()]),
      ttlSeconds: 60,
    });
    const loader = vi.fn(() => "loaded");

    await cache().entry(definition).set(value);

    expect(await cache().entry(definition).remember(loader)).toBe(value);
    expect(loader).not.toHaveBeenCalled();
  });

  it.each([
    ["a value the schema rejects", JSON.stringify({ topics: "many" })],
    ["text that is not JSON", "{not json"],
  ])("misses on %s and deletes it", async (_, stored) => {
    const { cache, raw, write } = setup();
    const entry = cache().entry(statsEntry, 1);
    await write(entry.key, stored);

    expect(await entry.get()).toBeUndefined();
    expect(await raw(entry.key)).toBeNull();
  });

  it("refuses an invalid write before storing anything", async () => {
    const { cache, raw } = setup();
    const entry = cache().entry(statsEntry, 1);

    const rejected = entry.set({ topics: SECRET } as unknown as {
      topics: number;
    });

    await expect(rejected).rejects.toThrow(CacheEntryValidationError);
    await expect(rejected).rejects.not.toThrow(SECRET);
    expect(await raw(entry.key)).toBeNull();
  });

  it("refuses a loader result the schema rejects, and stores nothing", async () => {
    const { cache, raw } = setup();
    const entry = cache().entry(statsEntry, 1);

    await expect(
      entry.remember(() => ({ topics: 1.5 })),
    ).rejects.toBeInstanceOf(CacheEntryValidationError);
    expect(await raw(entry.key)).toBeNull();
  });

  it("stores the JSON wire and returns the schema's output on both paths", async () => {
    const { cache, raw } = setup();
    const definition = defineCacheEntry({
      pluginId: "@vitnode/forum",
      name: "last-post",
      version: 1,
      schema: z.object({
        at: z.iso.datetime().transform(value => new Date(value)),
      }),
      ttlSeconds: 60,
    });
    const at = "2026-11-11T10:00:00.000Z";
    const loader = vi.fn(() => ({ at }));
    const entry = cache().entry(definition);

    const missed = await entry.remember(loader);
    const hit = await entry.remember(loader);

    expect(missed).toEqual({ at: new Date(at) });
    expect(hit).toEqual({ at: new Date(at) });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await raw(entry.key)) ?? "null")).toEqual({ at });
  });

  it("stores under the defining plugin, whichever plugin the request is for", async () => {
    const { cache } = setup();

    await cache("@vitnode/blog").entry(statsEntry, 1).set({ topics: 1 });

    expect(await cache("@vitnode/core").entry(statsEntry, 1).get()).toEqual({
      topics: 1,
    });
    expect(await cache().entry(statsEntry, 1).get()).toEqual({ topics: 1 });
  });

  it("flushes the request plugin's entries and leftover keys, and nothing else", async () => {
    const { cache, raw, write } = setup();
    const otherStats = defineCacheEntry({
      ...statsEntry,
      pluginId: "@vitnode/blog",
    });
    await cache().entry(statsEntry, 1).set({ topics: 1 });
    await cache().entry(otherStats, 1).set({ topics: 2 });
    await write("vitnode:cache:@vitnode/forum:legacy", "1");
    await write("vitnode:cache:@vitnode/blog:legacy", "1");
    await write("vitnode:cache:__system__:session", "1");

    await cache("@vitnode/forum").flush();

    expect(await cache().entry(statsEntry, 1).get()).toBeUndefined();
    expect(await raw("vitnode:cache:@vitnode/forum:legacy")).toBeNull();
    expect(await cache().entry(otherStats, 1).get()).toEqual({ topics: 2 });
    expect(await raw("vitnode:cache:@vitnode/blog:legacy")).toBe("1");
    expect(await raw("vitnode:cache:__system__:session")).toBe("1");
  });

  it("setIfMissing claims a missing key and resolves to the claimed value", async () => {
    const { cache, raw } = setup();
    const entry = cache().entry(statsEntry, 1);

    expect(await entry.setIfMissing({ topics: 1 })).toEqual({ topics: 1 });
    expect(JSON.parse((await raw(entry.key)) ?? "null")).toEqual({
      topics: 1,
    });
  });

  it("setIfMissing keeps a stored value and resolves to it", async () => {
    const { cache } = setup();
    const entry = cache().entry(statsEntry, 1);
    await entry.set({ topics: 1 });

    expect(await entry.setIfMissing({ topics: 2 })).toEqual({ topics: 1 });
    expect(await entry.get()).toEqual({ topics: 1 });
  });

  it("setIfMissing lets one of two concurrent claims win, for both", async () => {
    const { cache } = setup();

    const claims = await Promise.all([
      cache().entry(statsEntry, 1).setIfMissing({ topics: 1 }),
      cache().entry(statsEntry, 1).setIfMissing({ topics: 2 }),
    ]);

    expect(claims).toEqual([{ topics: 1 }, { topics: 1 }]);
    expect(await cache().entry(statsEntry, 1).get()).toEqual({ topics: 1 });
  });

  it.each([
    ["a value the schema rejects", JSON.stringify({ topics: "many" })],
    ["text that is not JSON", "{not json"],
  ])("setIfMissing replaces %s", async (_, stored) => {
    const { cache, write } = setup();
    const entry = cache().entry(statsEntry, 1);
    await write(entry.key, stored);

    expect(await entry.setIfMissing({ topics: 2 })).toEqual({ topics: 2 });
    expect(await entry.get()).toEqual({ topics: 2 });
  });

  it("setIfMissing refuses an invalid value before storing anything", async () => {
    const { cache, raw } = setup();
    const entry = cache().entry(statsEntry, 1);

    await expect(entry.setIfMissing({ topics: 1.5 })).rejects.toBeInstanceOf(
      CacheEntryValidationError,
    );
    expect(await raw(entry.key)).toBeNull();
  });

  it("setIfMissing resolves to the schema's output whether it claimed or found", async () => {
    const { cache } = setup();
    const definition = defineCacheEntry({
      pluginId: "@vitnode/forum",
      name: "first-post",
      version: 1,
      schema: z.object({
        at: z.iso.datetime().transform(value => new Date(value)),
      }),
      ttlSeconds: 60,
    });
    const first = "2026-11-11T10:00:00.000Z";

    const claimed = await cache().entry(definition).setIfMissing({ at: first });
    const found = await cache()
      .entry(definition)
      .setIfMissing({ at: "2026-11-12T10:00:00.000Z" });

    expect(claimed).toEqual({ at: new Date(first) });
    expect(found).toEqual({ at: new Date(first) });
  });

  it("does not flush anything without a plugin on the request", async () => {
    const { cache } = setup();
    await cache().entry(statsEntry, 1).set({ topics: 1 });

    await cache().flush();

    expect(await cache().entry(statsEntry, 1).get()).toEqual({ topics: 1 });
  });
});

describe("CacheModel.entry without a store", () => {
  it("misses every read and runs the loader every time", async () => {
    const entry = new CacheModel(null, contextOf()).entry(statsEntry, 1);
    const loader = vi.fn(() => ({ topics: 1 }));

    await entry.set({ topics: 1 });
    expect(await entry.get()).toBeUndefined();
    await entry.remember(loader);
    await entry.remember(loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("resolves setIfMissing to the value without storing it", async () => {
    const entry = new CacheModel(null, contextOf()).entry(statsEntry, 1);

    expect(await entry.setIfMissing({ topics: 1 })).toEqual({ topics: 1 });
    expect(await entry.setIfMissing({ topics: 2 })).toEqual({ topics: 2 });
    expect(await entry.get()).toBeUndefined();
  });
});

describe("CacheModel.entry when Redis fails", () => {
  it("swallows read and write errors and falls back to the loader", async () => {
    const failing = async () => await Promise.reject(new Error("ECONNRESET"));
    const client = {
      del: failing,
      get: failing,
      set: failing,
    } as unknown as CacheClient;
    const entry = new CacheModel(client, contextOf()).entry(statsEntry, 1);

    await expect(entry.set({ topics: 1 })).resolves.toBeUndefined();
    expect(await entry.get()).toBeUndefined();
    expect(await entry.remember(() => ({ topics: 2 }))).toEqual({ topics: 2 });
    expect(await entry.setIfMissing({ topics: 3 })).toEqual({ topics: 3 });
  });
});

describe("CacheModel.entry().setIfMissing TTL", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("claims in Redis with SET NX and the entry's TTL", async () => {
    const client = createTestCacheClient();
    const set = vi.spyOn(client, "set");
    const entry = new CacheModel(client, contextOf()).entry(statsEntry, 1);

    await entry.setIfMissing({ topics: 1 });

    expect(set).toHaveBeenCalledWith(entry.key, JSON.stringify({ topics: 1 }), {
      condition: "NX",
      expiration: { type: "EX", value: statsEntry.ttlSeconds },
    });
  });

  it("caps the in-memory claim at the memory store's TTL", async () => {
    vi.useFakeTimers();
    const entry = new CacheModel(
      null,
      contextOf(),
      new MemoryCacheStore(),
    ).entry(statsEntry, 1);
    expect(statsEntry.ttlSeconds).toBeGreaterThan(MEMORY_CACHE_MAX_TTL_SECONDS);

    await entry.setIfMissing({ topics: 1 });
    vi.advanceTimersByTime(MEMORY_CACHE_MAX_TTL_SECONDS * 1000 - 1);
    expect(await entry.get()).toEqual({ topics: 1 });

    vi.advanceTimersByTime(1);
    expect(await entry.get()).toBeUndefined();
    expect(await entry.setIfMissing({ topics: 2 })).toEqual({ topics: 2 });
  });
});

describe("domainCacheOf", () => {
  const contextWith = (cache: unknown) =>
    ({
      get: (key: string) => (key === "cache" ? cache : undefined),
    }) as unknown as Context;

  it("exposes only entry and flush, frozen", () => {
    const facade = domainCacheOf(new CacheModel(null, contextOf()));

    expect(Reflect.ownKeys(facade)).toHaveLength(2);
    expect(Reflect.ownKeys(facade)).toEqual(
      expect.arrayContaining(["entry", "flush"]),
    );
    expect(Object.isFrozen(facade)).toBe(true);
    expect("getSystem" in facade).toBe(false);
  });

  it.each(backends)(
    "shares the store's %s backend with cacheStore",
    async (_, setup) => {
      const { cache } = setup();
      const store = cache("@vitnode/forum");
      const facade = domainCacheOf(store);
      const c = contextWith(facade);

      await facade.entry(statsEntry, 1).set({ topics: 1 });
      expect(cacheStore(c)).toBe(store);
      expect(await cacheStore(c).entry(statsEntry, 1).get()).toEqual({
        topics: 1,
      });

      await cacheStore(c).entry(statsEntry, 2).set({ topics: 2 });
      await facade.flush();
      expect(await store.entry(statsEntry, 2).get()).toBeUndefined();
    },
  );

  it("resolves a context holding a store to that store", () => {
    const store = new CacheModel(null, contextOf());

    expect(findCacheStore(contextWith(store))).toBe(store);
    expect(cacheStore(contextWith(store))).toBe(store);
  });

  it.each([
    ["no cache", undefined],
    ["an object that is not a facade", { entry: () => undefined }],
  ])("finds no store on a context with %s", (_, cache) => {
    const c = contextWith(cache);

    expect(findCacheStore(c)).toBeUndefined();
    expect(() => cacheStore(c)).toThrow(/global middleware/);
  });
});
