/**
 * Upper bound on how long the in-process store keeps a cached value, whatever
 * TTL the caller asked for.
 *
 * The trade-off: this store lives in one process. On a single instance an
 * invalidation (a revoked session, a demoted admin) deletes the entry directly,
 * so it takes effect at once. With several instances and no Redis, an
 * invalidation only reaches the instance that handled it - the others keep
 * serving their copy until it expires. Capping every TTL bounds that window to
 * a few seconds while still absorbing the burst of lookups an authenticated
 * page load makes. Configure Redis for a cache shared across instances.
 */
export const MEMORY_CACHE_MAX_TTL_SECONDS = 15;

/** Enough for every active session on a busy single instance, and bounded. */
export const MEMORY_CACHE_MAX_ENTRIES = 10_000;

interface MemoryEntry {
  /** Epoch ms, or `null` for a key written without a TTL. */
  expiresAt: null | number;
  raw: string;
}

/**
 * The cache backend used when no Redis client is configured: a bounded LRU
 * over a `Map` (insertion order doubles as recency order). Holds serialized
 * JSON so callers get a fresh copy on every read, as they would from Redis.
 *
 * Keys written without a TTL (generation stamps such as the staff-permission
 * epoch) never expire on time, only by eviction - and since every entry filed
 * under an old generation stops being read once the stamp moves, LRU evicts
 * those entries before it ever evicts the stamp that still gets read.
 */
export class MemoryCacheStore {
  constructor(maxEntries = MEMORY_CACHE_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  private readonly entries = new Map<string, MemoryEntry>();
  private readonly maxEntries: number;

  private insert(key: string, entry: MemoryEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  private live(key: string, now = Date.now()): MemoryEntry | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      this.entries.delete(key);

      return null;
    }

    return entry;
  }

  delete(keys: string[]): void {
    for (const key of keys) this.entries.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  get(key: string): null | string {
    const entry = this.live(key);
    if (!entry) return null;

    // Touch: move to the most-recently-used end.
    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.raw;
  }

  has(key: string): boolean {
    return this.live(key) !== null;
  }

  /** Stores a cached value, its TTL capped at {@link MEMORY_CACHE_MAX_TTL_SECONDS}. */
  set(key: string, raw: string, ttlSeconds?: number): void {
    const ttl =
      ttlSeconds && ttlSeconds > 0
        ? Math.min(ttlSeconds, MEMORY_CACHE_MAX_TTL_SECONDS)
        : null;

    this.insert(key, {
      expiresAt: ttl === null ? null : Date.now() + ttl * 1000,
      raw,
    });
  }

  /**
   * `SET NX EX` for locks. The TTL is honoured as given rather than capped: a
   * lock is a coordination window, not a cached copy that can go stale.
   */
  setIfAbsent(key: string, raw: string, ttlSeconds: number): boolean {
    const now = Date.now();
    if (this.live(key, now)) return false;

    this.insert(key, { expiresAt: now + ttlSeconds * 1000, raw });

    return true;
  }
}
