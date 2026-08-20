/**
 * Caching and revalidation, done through VitNode rather than through Next.
 *
 * Importing this module installs the Next.js adapter as the default, so server
 * code gets working `expireCacheTags()` / `expireCachePath()` /
 * `tagCacheEntry()` / `setCacheEntryLife()` with no setup. An application on
 * another host framework calls `setCacheAdapter()` with its own adapter, which
 * takes precedence.
 *
 * `./next` is the only file behind this barrel that touches `next/*`, and it
 * carries `server-only` - so this module does too. Code that has to load in
 * plain Node (`content/`, `content/server/`, drizzle-kit) must import
 * `./runtime` and `./types` directly instead, both of which are framework-free.
 *
 * The cache *tags* are not here: they are plain strings, built per content type
 * in `@vitnode/core/content` and per feature in `@vitnode/core/lib/cache-tags`,
 * so an application can name the same tag its own cached functions carry.
 */
import { nextCacheAdapter } from "./next";
import { setDefaultCacheAdapter } from "./runtime";

setDefaultCacheAdapter(nextCacheAdapter);

export { nextCacheAdapter } from "./next";
export {
  expireCachePath,
  expireCacheTags,
  getCacheAdapter,
  hasCacheAdapter,
  resetCacheAdapter,
  setCacheAdapter,
  setCacheEntryLife,
  setDefaultCacheAdapter,
  tagCacheEntry,
} from "./runtime";
export type {
  CacheAdapter,
  CacheExpiryContext,
  CacheExpiryMode,
  CacheExpiryOptions,
  CacheLifeProfile,
  CachePathScope,
} from "./types";
