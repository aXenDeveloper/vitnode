import { cacheRedisRead, cacheRedisWrite, NEXT_CACHE_PREFIX } from "./client";
import {
  areTagsExpired,
  areTagsStale,
  latestTagExpiration,
  readTagStates,
  writeTagStates,
} from "./tags";

/**
 * Next's sentinel for "never expires" (`0xfffffffe` seconds, ~136 years).
 *
 * Declared here rather than imported from `next/dist/lib/constants` so a handler
 * that Next loads by path does not reach back into Next's internals for a
 * number.
 */
const INFINITE_CACHE = 0xfffffffe;

const entryKey = (cacheKey: string): string =>
  `${NEXT_CACHE_PREFIX}uc:${cacheKey}`;

/**
 * One `"use cache"` entry as it is stored.
 *
 * `value` is the rendered payload base64-encoded inside the JSON envelope. A
 * separate binary key would avoid the ~33% encoding overhead, but it would also
 * make an entry two keys that can expire independently - and half an entry is
 * worse than none.
 */
interface StoredEntry {
  expire: number;
  revalidate: number;
  stale: number;
  tags: string[];
  timestamp: number;
  value: string;
}

/**
 * The shape Next's `"use cache"` handler contract requires.
 *
 * Declared locally rather than imported from `next/dist/server/lib/cache-handlers/types`
 * so that a moved internal path breaks a type test rather than the package build.
 * `use-cache-handler.test-d.ts` asserts this stays assignable to the real one.
 */
export interface UseCacheEntry {
  expire: number;
  revalidate: number;
  stale: number;
  tags: string[];
  timestamp: number;
  value: ReadableStream<Uint8Array>;
}

export interface UseCacheHandler {
  get: (
    cacheKey: string,
    softTags: string[],
  ) => Promise<undefined | UseCacheEntry>;
  getExpiration: (tags: string[]) => Promise<number>;
  refreshTags: () => Promise<void>;
  set: (
    cacheKey: string,
    pendingEntry: Promise<UseCacheEntry>,
  ) => Promise<void>;
  updateTags: (
    tags: string[],
    durations?: { expire?: number },
  ) => Promise<void>;
}

/** Drains a stream into one buffer, so it can be handed to Redis. */
const readStream = async (
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks);
};

const toStream = (payload: Buffer): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(payload));
      controller.close();
    },
  });

/**
 * In-flight writes, so a `get` racing a `set` for the same key waits for it.
 *
 * Per process and intentionally so: it coordinates this instance's own reads
 * with its own writes. Another instance racing the same key simply misses once.
 */
const pendingSets = new Map<string, Promise<void>>();

/**
 * A `"use cache"` handler backed by Redis.
 *
 * Two things it buys over the in-memory default, and both only matter once there
 * is more than one process: entries survive a restart or a rolling deploy, and
 * every instance sees the same entry - so `updateTag` from a Server Action on
 * one instance is not invisible to the other three.
 *
 * ## What it deliberately does not do
 *
 * It does not drop an entry once it is past `revalidate`. Next's in-memory
 * handler does, on the grounds that warming an entry an LRU is about to evict is
 * wasted work; a shared store has the opposite incentive, so a stale entry is
 * served while the wrapper rebuilds it in the background. Redis holds the entry
 * for `expire`, which is the point past which Next would refuse to serve it
 * anyway.
 *
 * It also keeps no in-process copy in front of Redis. One would save a
 * round-trip on a hot key and immediately reintroduce the divergence between
 * instances this handler exists to remove.
 */
const handler: UseCacheHandler = {
  /**
   * Reads an entry, and reports whether its tags have moved under it.
   *
   * The contract passes the request's implicit tags as a second argument. They
   * are deliberately not taken: {@link getExpiration} answers for those, which is
   * the division of labour the contract asks for. What is checked here is the
   * entry's own tags, because those were written with it and nothing else will
   * look at them.
   */
  async get(cacheKey) {
    // A set for this key may still be draining its stream. Waiting is what keeps
    // a concurrent reader from missing and rendering the same thing again.
    await pendingSets.get(cacheKey);

    const raw = await cacheRedisRead<null | string>(
      async client => await client.get(entryKey(cacheKey)),
      null,
    );
    if (raw === null) return undefined;

    let stored: StoredEntry;
    try {
      stored = JSON.parse(raw) as StoredEntry;
    } catch {
      return undefined;
    }

    const tags = stored.tags ?? [];
    const states = await readTagStates(tags);

    if (areTagsExpired(states, tags, stored.timestamp)) return undefined;

    return {
      expire: stored.expire,
      // `-1` is Next's signal to revalidate this entry now while still serving
      // it, which is exactly what a stale (rather than expired) tag means.
      revalidate: areTagsStale(states, tags, stored.timestamp)
        ? -1
        : stored.revalidate,
      stale: stored.stale,
      tags,
      timestamp: stored.timestamp,
      value: toStream(Buffer.from(stored.value, "base64")),
    };
  },

  async getExpiration(tags) {
    return latestTagExpiration(await readTagStates(tags), tags);
  },

  /**
   * Nothing to pull in.
   *
   * Next calls this before a request so a handler can refresh a local manifest.
   * This one has no manifest: {@link get} and {@link getExpiration} read the tags
   * they actually need, when they need them, which is both fresher and cheaper
   * than syncing every tag the deployment has ever revalidated.
   */
  async refreshTags() {
    await Promise.resolve();
  },

  /**
   * Stores an entry once its stream has finished.
   *
   * The entry arrives as a promise whose `value` stream may still be being
   * written, so it is drained in full before anything is stored - a half-written
   * payload in a shared cache would be served to every instance.
   */
  async set(cacheKey, pendingEntry) {
    let release = (): void => {};
    pendingSets.set(
      cacheKey,
      new Promise<void>(resolve => {
        release = resolve;
      }),
    );

    try {
      const entry = await pendingEntry;

      // `expire: 0` is a dynamic entry: the wrapper regenerates it on every read
      // rather than serving a stored copy, so writing it is a round-trip for a
      // value nothing will ever read back.
      if (entry.expire === 0) return;

      const payload = await readStream(entry.value);
      const stored: StoredEntry = {
        expire: entry.expire,
        revalidate: entry.revalidate,
        stale: entry.stale,
        tags: entry.tags,
        timestamp: entry.timestamp,
        value: payload.toString("base64"),
      };

      await cacheRedisWrite(async client => {
        const raw = JSON.stringify(stored);

        // Redis expiry is a backstop that keeps abandoned entries from
        // accumulating. Next enforces `expire` itself on read, so the two agree;
        // an "infinite" entry simply gets no TTL rather than a 136-year one.
        if (entry.expire >= INFINITE_CACHE) {
          await client.set(entryKey(cacheKey), raw);

          return;
        }

        await client.set(entryKey(cacheKey), raw, {
          expiration: {
            type: "EX",
            value: Math.max(1, Math.ceil(entry.expire)),
          },
        });
      });
    } catch {
      /* a failed write is a future miss, not a failed request */
    } finally {
      release();
      pendingSets.delete(cacheKey);
    }
  },

  async updateTags(tags, durations) {
    await writeTagStates(tags, durations);
  },
};

export default handler;
