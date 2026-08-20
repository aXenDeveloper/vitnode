import { cacheRedisRead, cacheRedisWrite, NEXT_CACHE_PREFIX } from "./client";
import { areTagsExpired, readTagStates, writeTagStates } from "./tags";

/** Next's header carrying a response's cache tags, as a comma-separated list. */
const NEXT_CACHE_TAGS_HEADER = "x-next-cache-tags";

/**
 * How long a stored `fetch` response is kept in Redis.
 *
 * The Data Cache has no expiry of its own - Next stores `revalidate` alongside
 * the entry and decides freshness on read - so without a ceiling here an entry
 * for a URL nothing requests any more would sit in Redis forever. A week is long
 * enough that it never truncates a live cache and short enough that abandoned
 * keys go away.
 */
const FETCH_RETENTION_SECONDS = 60 * 60 * 24 * 7;

const fetchKey = (cacheKey: string): string =>
  `${NEXT_CACHE_PREFIX}fetch:${cacheKey}`;

interface StoredFetchEntry {
  lastModified: number;
  value: Record<string, unknown> & { tags?: string[] };
}

/**
 * The subset of Next's cache-handler context this needs, declared locally so a
 * change to Next's internal types cannot break the package build. The
 * conformance test asserts the real context is still assignable.
 */
export interface IncrementalCacheHandlerContext {
  [key: string]: unknown;
  revalidatedTags?: string[];
}

interface FetchGetContext {
  kind: "FETCH";
  softTags?: string[];
  tags?: string[];
}

interface ResponseGetContext {
  kind: "APP_PAGE" | "APP_ROUTE" | "IMAGE" | "PAGES";
}

type GetContext = FetchGetContext | ResponseGetContext;

interface HandlerValue {
  lastModified?: number;
  value: null | (Record<string, unknown> & { tags?: string[] });
}

/**
 * Next's own filesystem handler, which this one wraps rather than replaces.
 *
 * Typed loosely on purpose: it is reached through a deep path into Next's build
 * output, so the less this file asserts about its shape, the less an internal
 * refactor of Next can break.
 */
interface FileSystemCacheLike {
  get: (key: string, ctx: unknown) => Promise<HandlerValue | null>;
  resetRequestCache?: () => void;
  revalidateTag: (
    tags: readonly string[] | string,
    durations?: { expire?: number },
  ) => Promise<void>;
  set: (key: string, data: unknown, ctx: unknown) => Promise<void>;
}

type FileSystemCacheConstructor = new (
  ctx: IncrementalCacheHandlerContext,
) => FileSystemCacheLike;

/**
 * The tags on a cached page response.
 *
 * Page entries carry their tags in a response header rather than a field, which
 * is where Next itself reads them from when deciding whether a tag revalidation
 * has outdated a prerendered route.
 */
const responseTags = (value: HandlerValue["value"]): string[] => {
  const headers = (value as null | { headers?: Record<string, unknown> })
    ?.headers;
  const header = headers?.[NEXT_CACHE_TAGS_HEADER];

  return typeof header === "string" && header.length > 0
    ? header.split(",").filter(Boolean)
    : [];
};

/**
 * The Data Cache and prerender store, backed by Redis where that is safe.
 *
 * A custom handler here **fully replaces** Next's filesystem cache - there is no
 * fallback path, `incrementalCache.get` calls the handler and nothing else. That
 * single fact shapes the whole design, because the pages `next build` prerendered
 * live on disk and nothing else will ever put them in Redis:
 *
 * - **`fetch` responses go to Redis.** They are written at runtime, they are
 *   plain JSON, and they are what the Content Engine's tagged reads produce. This
 *   is the half that genuinely benefits from being shared.
 * - **Pages, routes and images stay with Next's own filesystem handler**, which
 *   this class instantiates and delegates to. Their payloads are Next-internal
 *   shapes - `Buffer`s, a `Map` of RSC segments, postponed PPR state - that would
 *   have to be re-serialised here and re-checked on every Next upgrade, and the
 *   build output is identical on every instance anyway, so there is nothing to
 *   share.
 *
 * **Tag revalidation is shared for both.** That is the part that is otherwise
 * broken across instances: `revalidateTag` on the instance that handled the
 * Server Action does nothing for the other three, which keep serving the page
 * they already have. Every revalidation is recorded in Redis and checked on read
 * here, so a delegated filesystem entry is discarded when another instance
 * expired its tag - each instance then rebuilds its own copy.
 */
class VitNodeIncrementalCache {
  constructor(ctx: IncrementalCacheHandlerContext) {
    this.ctx = ctx;
    this.revalidatedTags = ctx.revalidatedTags ?? [];
  }

  private readonly ctx: IncrementalCacheHandlerContext;
  private fileSystemCache: FileSystemCacheLike | null = null;
  private readonly revalidatedTags: string[];

  /**
   * Loads Next's filesystem handler on first use.
   *
   * Imported by path at runtime, not at module scope: the import is only needed
   * once a page-shaped entry is actually asked for, and keeping it out of the
   * module's top level means a Next version that moved the file degrades to "no
   * prerender cache" rather than failing to load the handler at boot.
   */
  private async fs(): Promise<FileSystemCacheLike | null> {
    if (this.fileSystemCache) return this.fileSystemCache;

    try {
      const loaded: unknown =
        await import("next/dist/server/lib/incremental-cache/file-system-cache.js");
      const Ctor = ((loaded as { default?: unknown }).default ??
        loaded) as FileSystemCacheConstructor;

      this.fileSystemCache = new Ctor(this.ctx);

      return this.fileSystemCache;
    } catch {
      return null;
    }
  }

  /**
   * Whether a shared revalidation has outdated an entry this instance still has.
   *
   * The check Next performs against its in-process tags manifest, done against
   * the shared one instead - which is what makes an invalidation raised on
   * another instance visible here.
   */
  private async isOutdated(
    tags: string[],
    lastModified: number,
  ): Promise<boolean> {
    if (tags.length === 0) return false;
    if (tags.some(tag => this.revalidatedTags.includes(tag))) return true;

    return areTagsExpired(await readTagStates(tags), tags, lastModified);
  }

  async get(cacheKey: string, ctx: GetContext): Promise<HandlerValue | null> {
    if (ctx.kind !== "FETCH") {
      const fs = await this.fs();
      const entry = (await fs?.get(cacheKey, ctx)) ?? null;
      if (!entry?.value) return entry;

      return (await this.isOutdated(
        responseTags(entry.value),
        entry.lastModified ?? 0,
      ))
        ? null
        : entry;
    }

    const raw = await cacheRedisRead<null | string>(
      async client => await client.get(fetchKey(cacheKey)),
      null,
    );
    if (raw === null) return null;

    let stored: StoredFetchEntry;
    try {
      stored = JSON.parse(raw) as StoredFetchEntry;
    } catch {
      return null;
    }

    // Both halves matter: `tags` are what the entry was stored with, `softTags`
    // are the implicit route tags of the request reading it, and a revalidation
    // of either has to drop the entry.
    const tags = [
      ...new Set([
        ...(stored.value.tags ?? []),
        ...(ctx.tags ?? []),
        ...(ctx.softTags ?? []),
      ]),
    ];

    return (await this.isOutdated(tags, stored.lastModified))
      ? null
      : { lastModified: stored.lastModified, value: stored.value };
  }

  /** Delegates to the filesystem handler, which has per-request state. */
  resetRequestCache(): void {
    this.fileSystemCache?.resetRequestCache?.();
  }

  /**
   * Records a revalidation for every instance, then lets the filesystem handler
   * record it for this one.
   *
   * Both, not either: Redis is what the other instances read, and Next's
   * in-process manifest is what the filesystem handler consults on its own reads
   * within this process.
   */
  async revalidateTag(
    tags: readonly string[] | string,
    durations?: { expire?: number },
  ): Promise<void> {
    const list = typeof tags === "string" ? [tags] : [...tags];
    if (list.length === 0) return;

    await writeTagStates(list, durations);

    const fs = await this.fs();
    await fs?.revalidateTag(list, durations);
  }

  async set(cacheKey: string, data: unknown, ctx: unknown): Promise<void> {
    const kind = (ctx as undefined | { fetchCache?: boolean; kind?: string })
      ?.kind;
    const isFetch =
      kind === "FETCH" ||
      (data as null | { kind?: string })?.kind === "FETCH" ||
      (ctx as undefined | { fetchCache?: boolean })?.fetchCache === true;

    if (!isFetch) {
      const fs = await this.fs();
      await fs?.set(cacheKey, data, ctx);

      return;
    }

    if (!data) {
      await cacheRedisWrite(
        async client => await client.del(fetchKey(cacheKey)),
      );

      return;
    }

    const stored: StoredFetchEntry = {
      lastModified: Date.now(),
      value: data as StoredFetchEntry["value"],
    };

    await cacheRedisWrite(async client => {
      await client.set(fetchKey(cacheKey), JSON.stringify(stored), {
        expiration: { type: "EX", value: FETCH_RETENTION_SECONDS },
      });
    });
  }
}

export default VitNodeIncrementalCache;
