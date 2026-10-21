import type { Context } from "hono";

import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { CacheModel } from "@/api/lib/cache";

import { createTestCache, createTestCacheClient } from "@/tests/cache";

import { ogImageCacheKey, rememberOgImage } from "./cache.server";

const contextWith = (cache?: CacheModel): Context =>
  ({
    get: (key: string) => (key === "cache" ? cache : undefined),
  }) as unknown as Context;

const png = (byte: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, byte]);

/** The in-process store lives for the whole worker, so every test owns its keys. */
const freshKey = () => ogImageCacheKey(["test", randomUUID()]);

describe("ogImageCacheKey", () => {
  it("is stable for one identity and differs for another, order included", () => {
    expect(ogImageCacheKey(["content", 1, "en"])).toBe(
      ogImageCacheKey(["content", 1, "en"]),
    );
    expect(ogImageCacheKey(["content", 1, "en"])).not.toBe(
      ogImageCacheKey(["content", 1, "pl"]),
    );
    expect(ogImageCacheKey(["a", "b"])).not.toBe(ogImageCacheKey(["b", "a"]));
  });
});

describe.each([
  ["in process", () => undefined],
  ["in Redis", () => createTestCache()],
])("rememberOgImage %s", (_label, cacheFor) => {
  it("renders on a miss and serves the stored bytes on the next call", async () => {
    const c = contextWith(cacheFor());
    const key = freshKey();
    const render = vi.fn(async () => await Promise.resolve(png(1)));

    const first = await rememberOgImage(c, key, render);
    const second = await rememberOgImage(c, key, render);

    expect(first).toStrictEqual({ data: png(1), hit: false });
    expect(second.hit).toBe(true);
    expect(new Uint8Array(second.data)).toStrictEqual(png(1));
    expect(render).toHaveBeenCalledOnce();
  });

  it("renders once for concurrent misses of one key", async () => {
    const c = contextWith(cacheFor());
    const key = freshKey();
    const { promise, resolve } = Promise.withResolvers<Uint8Array>();
    const render = vi.fn(async () => await promise);

    const pending = Promise.all([
      rememberOgImage(c, key, render),
      rememberOgImage(c, key, render),
      rememberOgImage(c, key, render),
    ]);
    resolve(png(2));
    const results = await pending;

    expect(render).toHaveBeenCalledOnce();
    expect(results.map(result => result.hit)).toStrictEqual([
      false,
      true,
      true,
    ]);
    for (const result of results) {
      expect(new Uint8Array(result.data)).toStrictEqual(png(2));
    }
  });

  it("renders again for a different key", async () => {
    const c = contextWith(cacheFor());
    const render = vi.fn(async () => await Promise.resolve(png(3)));

    await rememberOgImage(c, freshKey(), render);
    await rememberOgImage(c, freshKey(), render);

    expect(render).toHaveBeenCalledTimes(2);
  });

  it("does not remember a failed render", async () => {
    const c = contextWith(cacheFor());
    const key = freshKey();

    await expect(
      rememberOgImage(c, key, async () => {
        await Promise.resolve();
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const render = vi.fn(async () => await Promise.resolve(png(4)));
    expect((await rememberOgImage(c, key, render)).hit).toBe(false);
    expect(render).toHaveBeenCalledOnce();
  });
});

describe("rememberOgImage in Redis", () => {
  it("shares one render between instances that use the same Redis", async () => {
    const client = createTestCacheClient();
    const key = freshKey();
    const render = vi.fn(async () => await Promise.resolve(png(5)));

    await rememberOgImage(contextWith(createTestCache(client)), key, render);
    const other = await rememberOgImage(
      contextWith(createTestCache(client)),
      key,
      render,
    );

    expect(other.hit).toBe(true);
    expect(new Uint8Array(other.data)).toStrictEqual(png(5));
    expect(render).toHaveBeenCalledOnce();

    // The bytes live in that Redis, not in this process.
    const elsewhere = await rememberOgImage(
      contextWith(createTestCache()),
      key,
      render,
    );
    expect(elsewhere.hit).toBe(false);
  });
});
