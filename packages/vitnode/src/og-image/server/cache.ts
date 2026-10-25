import type { CacheModel } from "@/api/lib/cache";

/**
 * How long Redis keeps a rendered card. Only a ceiling on storage: a card's
 * key changes whenever its content, template or branding does, so an entry is
 * never served for data it was not rendered from.
 */
export const OG_IMAGE_SHARED_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Bytes the per-process cache may hold. Oldest-used cards are dropped first. */
export const OG_IMAGE_LOCAL_CACHE_MAX_BYTES = 32 * 1024 * 1024;

/**
 * A byte-bounded LRU for PNGs. The shared `CacheModel` stores JSON, and its
 * in-memory fallback caps entries at 15 seconds and counts entries rather
 * than bytes - fine for sessions, wrong for images - so cards get their own
 * small store in front of it.
 */
export class OgImageLocalCache {
  constructor(maxBytes = OG_IMAGE_LOCAL_CACHE_MAX_BYTES) {
    this.maxBytes = maxBytes;
  }

  private readonly entries = new Map<string, Uint8Array>();
  private readonly maxBytes: number;
  private size = 0;

  clear(): void {
    this.entries.clear();
    this.size = 0;
  }

  get(key: string): null | Uint8Array {
    const value = this.entries.get(key);
    if (!value) return null;

    this.entries.delete(key);
    this.entries.set(key, value);

    return value;
  }

  set(key: string, value: Uint8Array): void {
    if (value.byteLength > this.maxBytes) return;

    const previous = this.entries.get(key);
    if (previous) {
      this.size -= previous.byteLength;
      this.entries.delete(key);
    }

    this.entries.set(key, value);
    this.size += value.byteLength;

    for (const [oldest, bytes] of this.entries) {
      if (this.size <= this.maxBytes) break;
      this.entries.delete(oldest);
      this.size -= bytes.byteLength;
    }
  }

  get totalBytes(): number {
    return this.size;
  }
}

/** The process-wide card cache. */
export const ogImageLocalCache = new OgImageLocalCache();

const sharedKey = (key: string): string => `og-image:${key}`;

/**
 * One cached card: the process cache first, then Redis when it is
 * configured. Without Redis each instance keeps its own copies.
 */
export const readOgImageCache = async (
  cache: CacheModel | undefined,
  key: string,
): Promise<null | Uint8Array> => {
  const local = ogImageLocalCache.get(key);
  if (local) return local;
  if (!cache?.isShared) return null;

  const stored = await cache.getSystem<string>(sharedKey(key));
  if (typeof stored !== "string") return null;

  const bytes = new Uint8Array(Buffer.from(stored, "base64"));
  ogImageLocalCache.set(key, bytes);

  return bytes;
};

/** Stores a card in both layers. Never throws: caching must not fail a request. */
export const writeOgImageCache = async (
  cache: CacheModel | undefined,
  key: string,
  png: Uint8Array,
): Promise<void> => {
  ogImageLocalCache.set(key, png);
  if (!cache?.isShared) return;

  await cache.setSystem(
    sharedKey(key),
    Buffer.from(png).toString("base64"),
    OG_IMAGE_SHARED_CACHE_TTL_SECONDS,
  );
};
