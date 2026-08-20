import type {
  CacheAdapter,
  CacheExpiryContext,
  CacheExpiryMode,
  CacheLifeProfile,
  CachePathScope,
} from "./types";

/**
 * Which adapter answers cache calls, and the helpers core code calls.
 *
 * Two slots rather than one, so installation is order-independent. A host
 * framework's adapter fills the *default* slot as a side effect of the barrel
 * being imported ({@link setDefaultCacheAdapter}); an application that wants a
 * different one calls {@link setCacheAdapter}, which always wins no matter which
 * module happened to evaluate first.
 *
 * This module imports nothing but its own types, so a cache adapter can be
 * written - and this registry loaded - without pulling Next into the graph.
 * `content/` and `content/server/`, which `apps/api` and drizzle-kit load in
 * plain Node, import this and `./types` rather than the barrel for that reason.
 */
let installed: CacheAdapter | undefined;
let fallback: CacheAdapter | undefined;

/** Install the cache adapter for this application. Overrides any default. */
export const setCacheAdapter = (adapter: CacheAdapter): void => {
  installed = adapter;
};

/**
 * Offer an adapter as the default, used only when nothing was installed
 * explicitly. Called by the barrel on import.
 */
export const setDefaultCacheAdapter = (adapter: CacheAdapter): void => {
  fallback = adapter;
};

/** Whether any adapter - installed or default - can answer a cache call. */
export const hasCacheAdapter = (): boolean =>
  installed !== undefined || fallback !== undefined;

/**
 * The adapter to call, or a thrown error naming the fix.
 *
 * It throws rather than falling back to doing nothing, and that is the whole
 * decision in this file. A silently absent cache adapter turns every mutation
 * into a page that keeps serving what it served before - a withdrawn post still
 * readable, a deleted file still listed - with no error anywhere to trace it
 * back from. A missing adapter is a wiring mistake, so the first call says so.
 */
export const getCacheAdapter = (): CacheAdapter => {
  const adapter = installed ?? fallback;
  if (!adapter) {
    throw new Error(
      "No VitNode cache adapter is installed. Import `@vitnode/core/framework/cache` (which installs the Next.js adapter) before expiring anything, or call `setCacheAdapter()` with your own adapter.",
    );
  }

  return adapter;
};

/** For tests: drop both slots so the next call starts from nothing. */
export const resetCacheAdapter = (): void => {
  installed = undefined;
  fallback = undefined;
};

/**
 * Expires every cache entry carrying any of these tags.
 *
 * Defaults are chosen for the mutation that *removes* something, because that is
 * where being wrong is a correctness bug rather than a slow page:
 *
 * - `mode` defaults to `immediate`. Stale-while-revalidate would keep serving an
 *   unpublished record, a deleted one, or a URL that has moved - for one more
 *   request each, which is one too many. A caller whose edit left the page
 *   reachable at the same address opts out explicitly.
 * - `context` defaults to `server-action`, which is where nearly every write
 *   path in VitNode already lives. Background work - a webhook, a cron callback,
 *   the content revalidation bridge - says `route-handler` and gets a primitive
 *   that is legal there.
 *
 * An empty list returns without touching the registry. Not a micro-optimisation:
 * `contentInvalidationTags` legitimately returns nothing for a mutation on a
 * record that was private before and after, and such a call must not be the
 * thing that discovers no adapter is installed.
 */
export const expireCacheTags = (
  tags: readonly string[] | string,
  options?: {
    context?: CacheExpiryContext;
    mode?: CacheExpiryMode;
  },
): void => {
  const list = typeof tags === "string" ? [tags] : tags;
  if (list.length === 0) return;

  getCacheAdapter().expireTags(list, {
    context: options?.context ?? "server-action",
    mode: options?.mode ?? "immediate",
  });
};

/**
 * Expires everything cached for a route path.
 *
 * `scope` has **no default**, and that is deliberate rather than an omission: a
 * scoped expiry and a bare one are keyed differently by the framework
 * underneath, so quietly filling in `page` here would silently retarget every
 * caller that meant the unscoped form. See {@link CachePathScope}.
 */
export const expireCachePath = (path: string, scope?: CachePathScope): void => {
  getCacheAdapter().expirePath(path, scope);
};

/**
 * Tags the cache entry currently being produced.
 *
 * Call it **synchronously, inside the cached function**, before the first
 * `await`. An adapter reaches the entry through async-local storage, and there
 * is no entry to tag from anywhere else.
 */
export const tagCacheEntry = (...tags: string[]): void => {
  if (tags.length === 0) return;

  getCacheAdapter().tagEntry(tags);
};

/**
 * Declares how long the cache entry currently being produced stays useful.
 *
 * Same placement rule as {@link tagCacheEntry}: synchronously, inside the cached
 * function.
 */
export const setCacheEntryLife = (profile: CacheLifeProfile): void => {
  getCacheAdapter().setEntryLife(profile);
};
