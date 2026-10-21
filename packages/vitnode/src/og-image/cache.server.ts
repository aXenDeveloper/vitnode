import type { Context } from "hono";

import { createHash } from "node:crypto";

import type { CacheModel } from "../api/lib/cache";

/** How long Redis keeps a rendered image. Keys change with the content, so this only reclaims space. */
export const OG_IMAGE_SHARED_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
/** How long the in-process fallback keeps a rendered image. */
export const OG_IMAGE_LOCAL_CACHE_TTL_MS = 10 * 60 * 1000;
/** The in-process fallback's budget: PNGs are evicted oldest first above it. */
export const OG_IMAGE_LOCAL_CACHE_MAX_BYTES = 32 * 1024 * 1024;

const SHARED_PREFIX = "og-image:";

/**
 * A byte-bounded LRU for rendered images when Redis is not configured. The
 * general in-process cache caps entries at 15 seconds and counts entries, not
 * bytes, which suits session lookups and not 100 KB PNGs.
 */
class LocalOgImageStore {
  private bytes = 0;
  private readonly entries = new Map<
    string,
    { data: Uint8Array; expiresAt: number }
  >();

  get(key: string): null | Uint8Array {
    const entry = this.entries.get(key);
    if (!entry) return null;

    this.entries.delete(key);
    if (entry.expiresAt <= Date.now()) {
      this.bytes -= entry.data.byteLength;

      return null;
    }
    this.entries.set(key, entry);

    return entry.data;
  }

  set(key: string, data: Uint8Array): void {
    if (data.byteLength > OG_IMAGE_LOCAL_CACHE_MAX_BYTES / 4) return;

    const previous = this.entries.get(key);
    if (previous) {
      this.entries.delete(key);
      this.bytes -= previous.data.byteLength;
    }

    this.entries.set(key, {
      data,
      expiresAt: Date.now() + OG_IMAGE_LOCAL_CACHE_TTL_MS,
    });
    this.bytes += data.byteLength;

    for (const [oldKey, entry] of this.entries) {
      if (this.bytes <= OG_IMAGE_LOCAL_CACHE_MAX_BYTES) break;
      this.entries.delete(oldKey);
      this.bytes -= entry.data.byteLength;
    }
  }
}

const local = new LocalOgImageStore();
const inflight = new Map<string, Promise<Uint8Array>>();

/**
 * The cache key of one image: a SHA-256 of `identity`, which must hold
 * everything the pixels depend on - who owns the image, the record and its
 * locale, the text and cover it was drawn from, the template id and version,
 * and the configuration version. Order matters; use a fixed tuple.
 */
export const ogImageCacheKey = (identity: readonly unknown[]): string =>
  createHash("sha256").update(JSON.stringify(identity)).digest("base64url");

const readCached = async (
  cache: CacheModel | undefined,
  key: string,
): Promise<null | Uint8Array> => {
  if (cache?.shared) {
    const value = await cache.getSystem<string>(`${SHARED_PREFIX}${key}`);

    return typeof value === "string" ? Buffer.from(value, "base64") : null;
  }

  return local.get(key);
};

const writeCached = async (
  cache: CacheModel | undefined,
  key: string,
  data: Uint8Array,
): Promise<void> => {
  if (cache?.shared) {
    await cache.setSystem(
      `${SHARED_PREFIX}${key}`,
      Buffer.from(data).toString("base64"),
      OG_IMAGE_SHARED_CACHE_TTL_SECONDS,
    );

    return;
  }

  local.set(key, data);
};

/**
 * Returns the cached PNG for `key`, or renders, stores and returns it.
 *
 * Stored in Redis (base64, under the shared system namespace) when the API has
 * `redis`, so every instance reuses one render; otherwise in a 32 MB in-process
 * LRU. Concurrent misses for one key in one process share a single render.
 * Callers must check that the image may be shown **before** calling this - a
 * hit says nothing about who may see it.
 */
export const rememberOgImage = async (
  c: Context,
  key: string,
  render: () => Promise<Uint8Array>,
): Promise<{ data: Uint8Array; hit: boolean }> => {
  const cache: CacheModel | undefined = c.get("cache");

  const cached = await readCached(cache, key);
  if (cached) return { data: cached, hit: true };

  const pending = inflight.get(key);
  if (pending) return { data: await pending, hit: true };

  const rendering = (async () => {
    const data = await render();
    await writeCached(cache, key, data);

    return data;
  })();
  inflight.set(key, rendering);

  try {
    return { data: await rendering, hit: false };
  } finally {
    inflight.delete(key);
  }
};
