import type { Context } from "hono";

import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import type {
  EnvVariablesVitNode,
  EnvVitNode,
} from "@/api/middlewares/global.middleware";

import { bindApiPlugin } from "@/api/lib/bind-api-plugin";
import { testManifest } from "@/tests/manifest";

import type { CacheEntryHandle, DomainCache } from "./cache";

declare const c: Context<EnvVitNode>;

const { defineCacheEntry } = bindApiPlugin(testManifest("@vitnode/forum"));

const statsCache = defineCacheEntry({
  name: "stats",
  version: 1,
  key: (forumId: number, locale: string) => [forumId, locale],
  schema: z.object({
    refreshedAt: z.iso.datetime().transform(value => new Date(value)),
    topics: z.number().int(),
  }),
  ttlSeconds: 60,
});

const singleCache = defineCacheEntry({
  name: "single",
  version: 1,
  schema: z.number(),
  ttlSeconds: 60,
});

describe("typed cache entries", () => {
  it("takes the key's arguments, and only those", () => {
    const cache = c.get("cache");

    cache.entry(statsCache, 1, "en");
    cache.entry(singleCache);
    // @ts-expect-error - forumId is a number
    cache.entry(statsCache, "1", "en");
    // @ts-expect-error - locale is missing
    cache.entry(statsCache, 1);
    // @ts-expect-error - one argument too many
    cache.entry(statsCache, 1, "en", true);
    // @ts-expect-error - a single-key entry takes no arguments
    cache.entry(singleCache, 1);
  });

  it("writes the schema's input and reads its output", async () => {
    const entry = c.get("cache").entry(statsCache, 1, "en");

    expectTypeOf(await entry.get()).toEqualTypeOf<
      undefined | { refreshedAt: Date; topics: number }
    >();
    expectTypeOf(
      await entry.remember(() => ({
        refreshedAt: "2026-11-11T10:00:00Z",
        topics: 1,
      })),
    ).toEqualTypeOf<{ refreshedAt: Date; topics: number }>();

    await entry.set({ refreshedAt: "2026-11-11T10:00:00Z", topics: 1 });
    // @ts-expect-error - the stored value takes an ISO string, not a Date
    await entry.set({ refreshedAt: new Date(), topics: 1 });
    // @ts-expect-error - topics is required
    await entry.set({ refreshedAt: "2026-11-11T10:00:00Z" });
    // @ts-expect-error - the loader must return the schema's input
    await entry.remember(() => ({ topics: "1" }));
  });

  it("no longer reads or writes by string key", async () => {
    const cache = c.get("cache");

    // @ts-expect-error - the string-key API is gone; use entry()
    await cache.get("forum-stats");
    // @ts-expect-error - the string-key API is gone; use entry()
    await cache.set("forum-stats", { topics: 1 });
    // @ts-expect-error - the string-key API is gone; use entry().remember()
    await cache.remember("forum-stats", () => 1);
    // @ts-expect-error - the string-key API is gone; use entry().delete()
    await cache.delete("forum-stats");
  });

  it("requires a JSON schema", () => {
    defineCacheEntry({
      name: "dated",
      version: 1,
      // @ts-expect-error - a Date does not survive the JSON store
      schema: z.date(),
      ttlSeconds: 60,
    });
  });
});

describe("the domain cache facade", () => {
  it("is the domain cache, with entries and a flush only", () => {
    expectTypeOf<EnvVariablesVitNode["cache"]>().toEqualTypeOf<DomainCache>();
    expectTypeOf(c.get("cache")).toEqualTypeOf<DomainCache>();
    expectTypeOf<keyof EnvVariablesVitNode["cache"]>().toEqualTypeOf<
      "entry" | "flush"
    >();
    expectTypeOf(c.get("cache").flush()).toEqualTypeOf<Promise<void>>();
  });

  it("hides the core store's infrastructure", async () => {
    const cache = c.get("cache");

    // @ts-expect-error - the system store is core infrastructure
    await cache.getSystem("session");
    // @ts-expect-error - the system store is core infrastructure
    await cache.getSystemMany(["session"]);
    // @ts-expect-error - the system store is core infrastructure
    await cache.setSystem("session", 1);
    // @ts-expect-error - the system store is core infrastructure
    await cache.deleteSystem("session");
    // @ts-expect-error - locks are core infrastructure
    await cache.acquireLock("cron", 60);
    // @ts-expect-error - locks are core infrastructure
    await cache.releaseLock("cron");
    // @ts-expect-error - lease sets are core infrastructure
    await cache.countLeases(["presence"]);
    // @ts-expect-error - lease sets are core infrastructure
    await cache.renewLease("presence", "member", 60);
    // @ts-expect-error - lease sets are core infrastructure
    await cache.releaseLeases("presence", ["member"]);
    // @ts-expect-error - connection status is core infrastructure
    await cache.status();
    // @ts-expect-error - connection status is core infrastructure
    cache.isConfigured();
  });

  it("infers an entry's key arguments and schema from its definition", () => {
    const cache: EnvVariablesVitNode["cache"] = c.get("cache");

    expectTypeOf(cache.entry(statsCache, 1, "en")).toEqualTypeOf<
      CacheEntryHandle<typeof statsCache.schema>
    >();
    expectTypeOf(cache.entry<[number, string], typeof statsCache.schema>)
      .parameter(1)
      .toEqualTypeOf<number>();
    expectTypeOf(cache.entry(singleCache).key).toEqualTypeOf<string>();
  });

  it("claims with the schema's input and resolves to its output", async () => {
    const entry = c.get("cache").entry(statsCache, 1, "en");

    expectTypeOf(
      await entry.setIfMissing({
        refreshedAt: "2026-11-11T10:00:00Z",
        topics: 1,
      }),
    ).toEqualTypeOf<{ refreshedAt: Date; topics: number }>();
    expectTypeOf(
      await c.get("cache").entry(singleCache).setIfMissing(1),
    ).toEqualTypeOf<number>();
    // @ts-expect-error - the stored value takes an ISO string, not a Date
    await entry.setIfMissing({ refreshedAt: new Date(), topics: 1 });
    // @ts-expect-error - topics is required
    await entry.setIfMissing({ refreshedAt: "2026-11-11T10:00:00Z" });
  });
});
