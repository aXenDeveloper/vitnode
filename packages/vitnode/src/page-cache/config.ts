import type { PageCacheSetting } from "./policy";

import { PageCachePolicyError, readPageCacheSetting } from "./policy";

/**
 * Where cached HTML lives. Chosen once, by the host application.
 *
 * - `"memory"` - inside each server process. Nothing to set up, but every
 *   instance keeps its own copy and a restart empties it.
 * - `"redis"` - the Redis named by the `REDIS_URL` environment variable, read
 *   when the server starts. Shared by every instance and survives restarts.
 */
export type PageCacheStorageKind = "memory" | "redis";

export const PAGE_CACHE_STORAGE_KINDS: readonly PageCacheStorageKind[] = [
  "memory",
  "redis",
];

export interface PageCacheConfig {
  /**
   * Turns the HTML cache off for the whole app. On by default in production;
   * development never caches, so an edit always shows up on reload.
   */
  enabled?: boolean;
  /**
   * Overrides keyed by canonical route path - `"/blog/:slug"` - for a plugin's
   * route or one of the app's own. `false` turns caching off for that route.
   */
  routes?: Readonly<Record<string, PageCacheSetting>>;
  storage?: PageCacheStorageKind;
}

export interface ResolvedPageCacheConfig {
  enabled: boolean;
  routes: Readonly<Record<string, PageCacheSetting>>;
  storage: PageCacheStorageKind;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const WHERE = "`vitNodeConfig.pageCache`";

/** The host's `pageCache` block, checked and with its defaults filled in. */
export const resolvePageCacheConfig = (
  value: unknown,
): ResolvedPageCacheConfig => {
  if (value === undefined) {
    return { enabled: true, routes: {}, storage: "memory" };
  }

  if (!isRecord(value)) {
    throw new PageCachePolicyError(`${WHERE} must be an object.`);
  }

  const { enabled = true, routes = {}, storage = "memory" } = value;

  if (typeof enabled !== "boolean") {
    throw new PageCachePolicyError(`${WHERE}.enabled must be a boolean.`);
  }

  if (!PAGE_CACHE_STORAGE_KINDS.includes(storage as PageCacheStorageKind)) {
    throw new PageCachePolicyError(
      `${WHERE}.storage is ${JSON.stringify(storage)}. Use ${PAGE_CACHE_STORAGE_KINDS.map(kind => JSON.stringify(kind)).join(" or ")}.`,
    );
  }

  if (!isRecord(routes)) {
    throw new PageCachePolicyError(
      `${WHERE}.routes must be an object keyed by route path.`,
    );
  }

  return {
    enabled,
    routes: Object.fromEntries(
      Object.entries(routes).map(([path, setting]) => [
        path,
        readPageCacheSetting(
          setting,
          `${WHERE}.routes[${JSON.stringify(path)}]`,
        ) ?? false,
      ]),
    ),
    storage: storage as PageCacheStorageKind,
  };
};

/** Reads `pageCache` off a loaded `vitnode.config.ts` module. */
export const pageCacheConfigFromLoadedConfig = (
  loaded: unknown,
): ResolvedPageCacheConfig =>
  resolvePageCacheConfig(
    isRecord(loaded) && isRecord(loaded.vitNodeConfig)
      ? loaded.vitNodeConfig.pageCache
      : undefined,
  );
