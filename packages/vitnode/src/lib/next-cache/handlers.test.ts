// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A Redis stand-in covering the handful of commands the handlers use.
 *
 * Injected by mocking `./client`, so the tests drive the real handler logic -
 * key layout, serialisation, tag comparisons - and only the socket is fake.
 * `fail: true` reproduces an unreachable Redis, which must degrade to a miss
 * rather than an exception.
 */
const store = new Map<string, string>();
let fail = false;

vi.mock("./client", () => ({
  NEXT_CACHE_PREFIX: "vitnode:next:",
  cacheRedisRead: async <T>(
    run: (client: unknown) => Promise<T>,
    fallback: T,
  ): Promise<T> => {
    if (fail) return fallback;

    try {
      return await run(client);
    } catch {
      return fallback;
    }
  },
  cacheRedisWrite: async (run: (client: unknown) => Promise<unknown>) => {
    if (fail) return;
    await run(client);
  },
  getCacheRedis: () => (fail ? null : client),
  isCacheRedisConfigured: () => !fail,
}));

const client = {
  del: async (key: string) => {
    store.delete(key);

    return Promise.resolve(1);
  },
  get: async (key: string) => Promise.resolve(store.get(key) ?? null),
  mGet: async (keys: string[]) =>
    Promise.resolve(keys.map(key => store.get(key) ?? null)),
  set: async (key: string, value: string) => {
    store.set(key, value);

    return Promise.resolve("OK");
  },
};

const fileSystemCache = {
  entries: new Map<string, unknown>(),
  revalidated: [] as string[],
  sets: [] as { data: unknown; key: string }[],
};

vi.mock("next/dist/server/lib/incremental-cache/file-system-cache.js", () => ({
  default: class {
    async get(key: string) {
      return Promise.resolve(fileSystemCache.entries.get(key) ?? null);
    }
    async revalidateTag(tags: string | string[]) {
      fileSystemCache.revalidated.push(
        ...(typeof tags === "string" ? [tags] : tags),
      );

      return Promise.resolve();
    }
    async set(key: string, data: unknown) {
      fileSystemCache.sets.push({ data, key });

      return Promise.resolve();
    }
  },
}));

const { default: useCacheHandler } = await import("./use-cache-handler");
const { default: IncrementalCacheHandler } =
  await import("./incremental-cache-handler");
const { readTagStates, writeTagStates } = await import("./tags");

/** A `"use cache"` entry with a one-chunk payload. */
const entry = ({
  expire = 3600,
  payload = "hello",
  revalidate = 60,
  tags = [] as string[],
  timestamp = Date.now(),
} = {}) => ({
  expire,
  revalidate,
  stale: 30,
  tags,
  timestamp,
  value: new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  }),
});

const readBack = async (
  value: ReadableStream<Uint8Array> | undefined,
): Promise<string> => {
  if (!value) return "";
  const chunks: Uint8Array[] = [];
  const reader = value.getReader();

  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    if (next.value) chunks.push(next.value);
  }

  return Buffer.concat(chunks).toString("utf8");
};

beforeEach(() => {
  store.clear();
  fail = false;
  fileSystemCache.entries.clear();
  fileSystemCache.revalidated.length = 0;
  fileSystemCache.sets.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("use cache handler", () => {
  it("round-trips an entry through Redis", async () => {
    await useCacheHandler.set("key", Promise.resolve(entry()));

    const found = await useCacheHandler.get("key", []);

    expect(found).toBeDefined();
    expect(found?.revalidate).toBe(60);
    expect(await readBack(found?.value)).toBe("hello");
  });

  it("misses for a key that was never written", async () => {
    expect(await useCacheHandler.get("absent", [])).toBeUndefined();
  });

  it("serves the payload to more than one reader", async () => {
    await useCacheHandler.set("key", Promise.resolve(entry()));

    expect(await readBack((await useCacheHandler.get("key", []))?.value)).toBe(
      "hello",
    );
    // A stream can only be consumed once, so a second read has to get its own.
    expect(await readBack((await useCacheHandler.get("key", []))?.value)).toBe(
      "hello",
    );
  });

  it("does not store a dynamic entry", async () => {
    await useCacheHandler.set("key", Promise.resolve(entry({ expire: 0 })));

    expect(await useCacheHandler.get("key", [])).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("drops an entry whose tag was revalidated after it was written", async () => {
    await useCacheHandler.set(
      "key",
      Promise.resolve(entry({ tags: ["posts"], timestamp: Date.now() - 5000 })),
    );

    await useCacheHandler.updateTags(["posts"]);

    expect(await useCacheHandler.get("key", [])).toBeUndefined();
  });

  it("keeps an entry written after the revalidation", async () => {
    await useCacheHandler.updateTags(["posts"]);

    await useCacheHandler.set(
      "key",
      Promise.resolve(entry({ tags: ["posts"], timestamp: Date.now() + 5000 })),
    );

    expect(await useCacheHandler.get("key", [])).toBeDefined();
  });

  it("leaves an unrelated tag alone", async () => {
    await useCacheHandler.set(
      "key",
      Promise.resolve(entry({ tags: ["posts"], timestamp: Date.now() - 5000 })),
    );

    await useCacheHandler.updateTags(["comments"]);

    expect(await useCacheHandler.get("key", [])).toBeDefined();
  });

  it("serves a stale-tagged entry but asks for revalidation", async () => {
    await useCacheHandler.set(
      "key",
      Promise.resolve(entry({ tags: ["posts"], timestamp: Date.now() - 5000 })),
    );

    // `expire` in the future is Next's stale-while-revalidate form: stale now,
    // hard-expired later.
    await useCacheHandler.updateTags(["posts"], { expire: 3600 });

    const found = await useCacheHandler.get("key", []);

    expect(found).toBeDefined();
    expect(found?.revalidate).toBe(-1);
  });

  it("reports the latest expiration across tags", async () => {
    await useCacheHandler.updateTags(["posts"]);

    expect(await useCacheHandler.getExpiration(["posts"])).toBeGreaterThan(0);
    expect(await useCacheHandler.getExpiration(["untouched"])).toBe(0);
  });

  it("misses instead of throwing when Redis is unreachable", async () => {
    await useCacheHandler.set("key", Promise.resolve(entry()));
    fail = true;

    await expect(useCacheHandler.get("key", [])).resolves.toBeUndefined();
    await expect(
      useCacheHandler.set("other", Promise.resolve(entry())),
    ).resolves.toBeUndefined();
    await expect(
      useCacheHandler.updateTags(["posts"]),
    ).resolves.toBeUndefined();
  });

  it("survives a corrupt entry", async () => {
    store.set("vitnode:next:uc:key", "{not json");

    expect(await useCacheHandler.get("key", [])).toBeUndefined();
  });
});

describe("incremental cache handler", () => {
  const handler = () => new IncrementalCacheHandler({ revalidatedTags: [] });

  it("stores and reads a fetch entry in Redis", async () => {
    const cache = handler();
    const value = { kind: "FETCH", data: { body: "x" }, revalidate: 60 };

    await cache.set("fetch-key", value, { kind: "FETCH" });
    const found = await cache.get("fetch-key", { kind: "FETCH" });

    expect(found?.value).toMatchObject(value);
    expect(fileSystemCache.sets).toHaveLength(0);
  });

  it("drops a fetch entry whose tag was revalidated elsewhere", async () => {
    const cache = handler();

    // The clock is driven explicitly because the comparison is strict - an entry
    // stamped in the same millisecond as the revalidation survives it, which is
    // Next's own rule and not something to paper over with a sleep.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await cache.set(
      "fetch-key",
      { kind: "FETCH", data: {}, tags: ["posts"], revalidate: 60 },
      { kind: "FETCH" },
    );

    // Simulates another instance expiring the tag after this entry was written.
    vi.setSystemTime(new Date("2026-01-01T00:00:05.000Z"));
    await writeTagStates(["posts"]);

    expect(await cache.get("fetch-key", { kind: "FETCH" })).toBeNull();
  });

  it("honours a revalidation matched by the request's soft tags", async () => {
    const cache = handler();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await cache.set(
      "fetch-key",
      { kind: "FETCH", data: {}, revalidate: 60 },
      { kind: "FETCH" },
    );

    vi.setSystemTime(new Date("2026-01-01T00:00:05.000Z"));
    await writeTagStates(["_N_T_/layout"]);

    expect(
      await cache.get("fetch-key", {
        kind: "FETCH",
        softTags: ["_N_T_/layout"],
      }),
    ).toBeNull();
  });

  it("deletes a fetch entry when set with no data", async () => {
    const cache = handler();

    await cache.set(
      "fetch-key",
      { kind: "FETCH", data: {}, revalidate: 60 },
      { kind: "FETCH" },
    );
    await cache.set("fetch-key", null, { kind: "FETCH" });

    expect(await cache.get("fetch-key", { kind: "FETCH" })).toBeNull();
  });

  it("delegates page entries to the filesystem handler", async () => {
    const cache = handler();
    const page = {
      lastModified: Date.now(),
      value: { kind: "APP_PAGE", html: "<p>hi</p>", headers: {} },
    };
    fileSystemCache.entries.set("/blog", page);

    expect(await cache.get("/blog", { kind: "APP_PAGE" })).toBe(page);

    await cache.set("/blog", page.value, { kind: "APP_PAGE" });
    expect(fileSystemCache.sets).toHaveLength(1);
    expect(store.size).toBe(0);
  });

  it("discards a delegated page whose tag another instance expired", async () => {
    const cache = handler();
    fileSystemCache.entries.set("/blog", {
      lastModified: Date.now() - 5000,
      value: {
        kind: "APP_PAGE",
        html: "<p>hi</p>",
        headers: { "x-next-cache-tags": "content:blog:list,other" },
      },
    });

    await writeTagStates(["content:blog:list"]);

    expect(await cache.get("/blog", { kind: "APP_PAGE" })).toBeNull();
  });

  it("keeps a delegated page whose tags are untouched", async () => {
    const cache = handler();
    const page = {
      lastModified: Date.now() - 5000,
      value: {
        kind: "APP_PAGE",
        html: "<p>hi</p>",
        headers: { "x-next-cache-tags": "content:blog:list" },
      },
    };
    fileSystemCache.entries.set("/blog", page);

    await writeTagStates(["something-else"]);

    expect(await cache.get("/blog", { kind: "APP_PAGE" })).toBe(page);
  });

  it("records a revalidation both for the cluster and for this process", async () => {
    const cache = handler();

    await cache.revalidateTag("posts");

    expect(fileSystemCache.revalidated).toEqual(["posts"]);
    expect(
      (await readTagStates(["posts"])).get("posts")?.expired,
    ).toBeGreaterThan(0);
  });

  it("treats tags revalidated during this request as expired", async () => {
    const cache = new IncrementalCacheHandler({ revalidatedTags: ["posts"] });

    await cache.set(
      "fetch-key",
      { kind: "FETCH", data: {}, tags: ["posts"], revalidate: 60 },
      { kind: "FETCH" },
    );

    expect(await cache.get("fetch-key", { kind: "FETCH" })).toBeNull();
  });
});
