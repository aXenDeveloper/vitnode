import type { CacheClient, DomainCache } from "@vitnode/core/api/lib/cache";
import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { CacheModel, domainCacheOf } from "@vitnode/core/api/lib/cache";
import { cacheEntryPrefix } from "@vitnode/core/api/lib/cache-entry";
import { MemoryCacheStore } from "@vitnode/core/api/lib/cache-memory";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import {
  articleCorrectionsCache,
  articleCorrectionsGenerationCache,
} from "@/api/cache/article-corrections.cache";
import { correctionFiledEvent } from "@/api/events";
import { announceCorrectionTask } from "@/api/tasks/announce-correction.task";
import { manifest } from "@/manifest.gen";

import type { CorrectionsServiceDeps } from "./corrections.service";

import { createCorrectionsService } from "./corrections.service";

const CREATED_AT = new Date("2026-11-11T12:00:00.000Z");

interface CorrectionRow {
  articleId: number;
  body: string;
  createdAt: Date;
  createdById: null | number;
  id: number;
}

const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>(done => {
    resolve = done;
  });

  return { promise, resolve };
};

const dialect = new PgDialect();

/** The article id a `where(eq(articleId, id))` condition filters on. */
const articleIdOf = (condition: SQL): number => {
  const [articleId] = dialect.sqlToQuery(condition).params;
  if (typeof articleId !== "number") {
    throw new TypeError("The list query must filter on one article id.");
  }

  return articleId;
};

/**
 * A db with one article table and the corrections table, and a queue whose
 * tasks commit with the transaction they were dispatched in. `log` records the
 * transaction's commit and rollback next to the other deps' calls, so a test
 * can check what ran inside and after it. `pauseNextLoad` holds the next list
 * query after it has read its rows, before they reach the cache.
 */
const createDeps = ({
  articleExists = true,
  cache: realCache,
  dispatch = async () => {},
}: {
  articleExists?: boolean;
  cache?: CorrectionsServiceDeps["cache"];
  dispatch?: () => Promise<void>;
} = {}) => {
  const log: string[] = [];
  const corrections: CorrectionRow[] = [];
  const tasks: unknown[] = [];
  const staged: unknown[] = [];
  const tx = {
    insert: () => ({
      values: (values: Omit<CorrectionRow, "createdAt" | "id">) => ({
        returning: async () => {
          const row = {
            ...values,
            createdAt: CREATED_AT,
            id: corrections.length + 1,
          };
          corrections.push(row);

          return await Promise.resolve([row]);
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () =>
            await Promise.resolve(articleExists ? [{ id: 3 }] : []),
        }),
      }),
    }),
  };

  let hold: null | { loaded: () => void; released: Promise<void> } = null;
  const pauseNextLoad = () => {
    const loaded = deferred();
    const released = deferred();
    hold = { loaded: loaded.resolve, released: released.promise };

    return { loaded: loaded.promise, release: released.resolve };
  };
  const listQuery = vi.fn(async (articleId: number) => {
    const rows = corrections
      .filter(row => row.articleId === articleId)
      .toReversed()
      .map(({ body, createdAt, id }) => ({ body, createdAt, id }));
    const pending = hold;
    hold = null;
    if (pending) {
      pending.loaded();
      await pending.released;
    }

    return rows;
  });
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: SQL) => ({
          orderBy: async () => await listQuery(articleIdOf(condition)),
        }),
      }),
    }),
    transaction: async <T>(run: (transaction: typeof tx) => Promise<T>) => {
      const snapshot = corrections.length;
      staged.length = 0;
      try {
        const result = await run(tx);
        tasks.push(...staged);
        log.push("commit");

        return result;
      } catch (error) {
        corrections.length = snapshot;
        staged.length = 0;
        log.push("rollback");
        throw error;
      }
    },
  };

  const record = async (step: string) => {
    log.push(step);
    await Promise.resolve();
  };
  const generationSet = vi.fn(
    async () => await record("cache.generation.advance"),
  );
  const fakeCache = {
    entry: vi.fn(() => ({ set: generationSet })),
  };
  const emit = vi.fn(async () => await record("emit"));
  const queueDispatch = vi.fn(async (_task: unknown, payload: unknown) => {
    await record("dispatch");
    await dispatch();
    staged.push(payload);
  });

  return {
    cache: fakeCache,
    deps: {
      cache:
        realCache ?? (fakeCache as unknown as CorrectionsServiceDeps["cache"]),
      db: db as unknown as CorrectionsServiceDeps["db"],
      events: { emit } as unknown as CorrectionsServiceDeps["events"],
      queue: {
        dispatch: queueDispatch,
      } as unknown as CorrectionsServiceDeps["queue"],
    },
    emit,
    generationSet,
    listQuery,
    log,
    pauseNextLoad,
    queueDispatch,
    tasks,
    tx,
  };
};

const filing = { actor: { id: 9 }, articleId: 3, body: "The date was wrong." };
const filed = {
  body: "The date was wrong.",
  createdAt: CREATED_AT.toISOString(),
  id: 1,
};

const contextWithoutPlugin = { get: () => undefined } as unknown as Context;

/** A Redis client with just what typed entries use, `SET NX` included. */
const createRedisClient = () => {
  const store = new Map<string, string>();
  const client = {
    del: async (keys: string | string[]) =>
      await Promise.resolve(
        (Array.isArray(keys) ? keys : [keys]).filter(key => store.delete(key))
          .length,
      ),
    get: async (key: string) => await Promise.resolve(store.get(key) ?? null),
    set: async (key: string, value: string, options?: { condition?: "NX" }) => {
      if (options?.condition === "NX" && store.has(key)) {
        return await Promise.resolve(null);
      }
      store.set(key, value);

      return await Promise.resolve("OK");
    },
  };

  return { client: client as unknown as CacheClient, store };
};

/** The request's `c.get("cache")` over Redis, and every key written. */
const redisBackend = () => {
  const { client, store } = createRedisClient();

  return {
    cache: domainCacheOf(new CacheModel(client, contextWithoutPlugin)),
    writtenKeys: () => [...store.keys()],
  };
};

/** The request's `c.get("cache")` over the in-memory store, and every key written. */
const memoryBackend = () => {
  const memory = new MemoryCacheStore();
  const set = vi.spyOn(memory, "set");
  const setIfAbsent = vi.spyOn(memory, "setIfAbsent");

  return {
    cache: domainCacheOf(new CacheModel(null, contextWithoutPlugin, memory)),
    writtenKeys: () =>
      [...set.mock.calls, ...setIfAbsent.mock.calls].map(([key]) => key),
  };
};

const backends = [
  ["Redis", redisBackend],
  ["memory", memoryBackend],
] as const;

/**
 * The cache, except that the first write to a generation (`set` or
 * `setIfMissing`) waits for `release` - a reader paused between its
 * generation miss and the write that initialises it.
 */
const holdGenerationClaim = (cache: DomainCache) => {
  const reached = deferred();
  const released = deferred();
  let holding = true;
  const hold = async () => {
    if (!holding) return;
    holding = false;
    reached.resolve();
    await released.promise;
  };
  const held: CorrectionsServiceDeps["cache"] = {
    entry: (definition, ...keyArgs) => {
      const handle = cache.entry(definition, ...keyArgs);
      if (definition.name !== articleCorrectionsGenerationCache.name) {
        return handle;
      }

      return {
        ...handle,
        set: async value => {
          await hold();
          await handle.set(value);
        },
        setIfMissing: async value => {
          await hold();

          return await handle.setIfMissing(value);
        },
      };
    },
  };

  return { cache: held, reached: reached.promise, release: released.resolve };
};

describe("createCorrectionsService().file", () => {
  it("queues the announcement in the transaction, then advances the generation and emits", async () => {
    const { cache, deps, emit, log, queueDispatch, tasks, tx } = createDeps();

    const result = await createCorrectionsService(deps).file(filing);

    expect(result).toEqual({
      correction: {
        articleId: 3,
        body: "The date was wrong.",
        createdAt: CREATED_AT,
        createdById: 9,
        id: 1,
      },
      ok: true,
    });
    expect(queueDispatch).toHaveBeenCalledWith(
      announceCorrectionTask,
      { correctionId: 1 },
      { tx },
    );
    expect(tasks).toEqual([{ correctionId: 1 }]);
    expect(log).toEqual([
      "dispatch",
      "commit",
      "cache.generation.advance",
      "emit",
    ]);
    expect(cache.entry).toHaveBeenCalledWith(
      articleCorrectionsGenerationCache,
      3,
    );
    expect(emit).toHaveBeenCalledWith(correctionFiledEvent, {
      articleId: 3,
      correctionId: 1,
    });
  });

  it("queues nothing, keeps the generation and emits nothing when the transaction fails", async () => {
    const failure = new Error("queue is down");
    const { cache } = memoryBackend();
    const { deps, emit, listQuery, log, tasks } = createDeps({
      cache,
      dispatch: async () => await Promise.reject(failure),
    });
    const service = createCorrectionsService(deps);
    await service.listForArticle(3);
    const generation = await cache
      .entry(articleCorrectionsGenerationCache, 3)
      .get();

    await expect(service.file(filing)).rejects.toBe(failure);

    expect(log).toEqual(["dispatch", "rollback"]);
    expect(tasks).toEqual([]);
    expect(emit).not.toHaveBeenCalled();
    expect(await cache.entry(articleCorrectionsGenerationCache, 3).get()).toBe(
      generation,
    );
    await expect(service.listForArticle(3)).resolves.toEqual({
      corrections: [],
    });
    expect(listQuery).toHaveBeenCalledOnce();
  });

  it("files nothing on an article that does not exist", async () => {
    const { deps, emit, generationSet, queueDispatch } = createDeps({
      articleExists: false,
    });

    await expect(createCorrectionsService(deps).file(filing)).resolves.toEqual({
      error: "article_not_found",
      ok: false,
    });
    expect(queueDispatch).not.toHaveBeenCalled();
    expect(generationSet).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});

describe.each(backends)(
  "createCorrectionsService().listForArticle (%s)",
  (_, setup) => {
    it("reads through the article's cache entry until a correction is filed", async () => {
      const { cache } = setup();
      const { deps, listQuery } = createDeps({ cache });
      const service = createCorrectionsService(deps);

      await expect(service.listForArticle(3)).resolves.toEqual({
        corrections: [],
      });
      await service.listForArticle(3);
      expect(listQuery).toHaveBeenCalledOnce();

      await service.file(filing);

      await expect(service.listForArticle(3)).resolves.toEqual({
        corrections: [filed],
      });
      expect(listQuery).toHaveBeenCalledTimes(2);
    });

    it.each([
      ["a stored generation", true],
      ["no generation yet", false],
    ])(
      "never caches rows loaded before a filing over it, with %s",
      async (__, warm) => {
        const { cache } = setup();
        const { deps, pauseNextLoad } = createDeps({ cache });
        const service = createCorrectionsService(deps);
        if (warm) {
          await cache
            .entry(articleCorrectionsGenerationCache, 3)
            .set("generation-before");
        }
        const load = pauseNextLoad();

        const reading = service.listForArticle(3);
        await load.loaded;
        await service.file(filing);
        load.release();

        await expect(reading).resolves.toEqual({ corrections: [] });
        await expect(service.listForArticle(3)).resolves.toEqual({
          corrections: [filed],
        });
      },
    );

    it("adopts the filing's generation when a cold reader claims after it", async () => {
      const { cache } = setup();
      const claim = holdGenerationClaim(cache);
      const { deps, listQuery } = createDeps({ cache: claim.cache });
      const service = createCorrectionsService(deps);
      const generation = cache.entry(articleCorrectionsGenerationCache, 3);

      const reading = service.listForArticle(3);
      await claim.reached;
      await service.file(filing);
      const filedGeneration = await generation.get();
      expect(filedGeneration).toEqual(expect.any(String));
      claim.release();

      await expect(reading).resolves.toEqual({ corrections: [filed] });
      expect(await generation.get()).toBe(filedGeneration);
      await expect(service.listForArticle(3)).resolves.toEqual({
        corrections: [filed],
      });
      expect(listQuery).toHaveBeenCalledOnce();
    });

    it("leaves another article's list and generation alone, under the plugin's keys", async () => {
      const { cache, writtenKeys } = setup();
      const { deps, listQuery } = createDeps({ cache });
      const service = createCorrectionsService(deps);
      await service.listForArticle(3);
      await service.listForArticle(4);
      const otherGeneration = await cache
        .entry(articleCorrectionsGenerationCache, 4)
        .get();

      await service.file(filing);

      expect(
        await cache.entry(articleCorrectionsGenerationCache, 4).get(),
      ).toBe(otherGeneration);
      expect(
        await cache
          .entry(articleCorrectionsCache, 4, otherGeneration ?? "")
          .get(),
      ).toEqual({ corrections: [] });
      await expect(service.listForArticle(4)).resolves.toEqual({
        corrections: [],
      });
      await expect(service.listForArticle(3)).resolves.toEqual({
        corrections: [filed],
      });
      expect(listQuery.mock.calls).toEqual([[3], [4], [3]]);
      expect(writtenKeys()).not.toHaveLength(0);
      expect(
        writtenKeys().filter(
          key => !key.startsWith(cacheEntryPrefix(manifest.id)),
        ),
      ).toEqual([]);
    });
  },
);

describe("createCorrectionsService().listForArticle without a cache store", () => {
  it("reads fresh rows from the database on every call", async () => {
    const { deps, listQuery } = createDeps({
      cache: domainCacheOf(new CacheModel(null, contextWithoutPlugin, null)),
    });
    const service = createCorrectionsService(deps);

    await expect(service.listForArticle(3)).resolves.toEqual({
      corrections: [],
    });
    await service.file(filing);
    await expect(service.listForArticle(3)).resolves.toEqual({
      corrections: [filed],
    });
    await service.listForArticle(3);

    expect(listQuery).toHaveBeenCalledTimes(3);
  });
});
