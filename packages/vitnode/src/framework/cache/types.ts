/**
 * The cache contract VitNode is written against.
 *
 * Types only, no implementation and no `next/*`, so this module is safe
 * everywhere the framework-independent layers are: `apps/api` (a plain
 * `@hono/node-server` process), drizzle-kit, and the browser. It is the whole
 * vocabulary a VitNode caller needs - nothing above this file names Next.
 *
 * Two things live here and they are deliberately separate:
 *
 * - **The verbs** ({@link CacheAdapter}), which one adapter implements per
 *   framework.
 * - **The nouns** - the modes, contexts and scopes a caller names. They are
 *   spelled in route-tree and freshness terms rather than in one framework's
 *   function names, because they have to keep meaning something when the
 *   adapter underneath changes.
 */

/**
 * How hard an expiry hits.
 *
 * `immediate` is the one to reach for when a mutation *removed* something: the
 * next reader must not be served the old response even once. It costs a cold
 * render.
 *
 * `stale-while-revalidate` keeps serving what is already stored while a fresh
 * copy is built behind it. Correct only for an edit that changed what a page
 * *says* while leaving it reachable at the same address - one more stale read is
 * survivable there, and the warm cache is worth more than the seconds of
 * freshness.
 */
export type CacheExpiryMode = "immediate" | "stale-while-revalidate";

/**
 * Where the expiry is being called from.
 *
 * Not decoration: frameworks give a mutation handler stronger cache primitives
 * than a webhook, and the strongest one available differs between the two. The
 * caller states its situation truthfully and the adapter picks - which is the
 * only arrangement that cannot produce a call that throws in production because
 * it was made from the wrong kind of handler.
 *
 * `server-action` is a request the user's own submit started, so the adapter may
 * use a primitive that gives that user read-your-own-writes. `route-handler` is
 * anything else that arrived over HTTP - a webhook, a cron callback, the content
 * revalidation bridge - where no such primitive exists.
 */
export type CacheExpiryContext = "route-handler" | "server-action";

/**
 * How much of the route tree a path expiry reaches.
 *
 * `page` is the leaf alone; `layout` is that route and everything nested under
 * it. Both are route-tree concepts rather than Next vocabulary - any framework
 * with nested layouts has the same two answers - so the names survive an adapter
 * swap even though the call underneath does not.
 *
 * Omitting it is a third, distinct answer rather than a synonym for `page`, and
 * the difference is load-bearing: a framework identifies a scoped expiry by a
 * *different* key than an unscoped one, so the two do not reach each other's
 * entries. Name a scope unless you specifically want the framework's own default
 * reach for a bare path.
 */
export type CachePathScope = "layout" | "page";

/**
 * How long a cache entry stays useful, named rather than measured.
 *
 * The set is deliberately closed, and deliberately the intersection of what
 * every adapter can honour: a profile invented in one framework's config file is
 * a number the next adapter has no way to read. A caller that needs an exact
 * duration is describing framework-specific behaviour and belongs on the other
 * side of an adapter, not in front of one.
 */
export type CacheLifeProfile =
  "days" | "default" | "hours" | "max" | "minutes" | "seconds" | "weeks";

/** What {@link CacheAdapter.expireTags} was told about the caller. */
export interface CacheExpiryOptions {
  context: CacheExpiryContext;
  mode: CacheExpiryMode;
}

/**
 * One framework's implementation of the contract.
 *
 * Four verbs, split down the middle by *when* they run:
 *
 * - `tagEntry` and `setEntryLife` describe an entry **while it is being
 *   produced**, so they are called from inside whatever the framework's cached
 *   function is and must stay synchronous - a framework that keeps this state in
 *   async-local storage loses it across an `await`.
 * - `expirePath` and `expireTags` act on entries **already stored**, from a
 *   mutation.
 *
 * Every method is `void`. Whether an expiry is applied synchronously, batched,
 * or posted to another process is the adapter's business, and a caller that
 * awaited it would be waiting on an implementation detail.
 */
export interface CacheAdapter {
  /**
   * Expires everything cached for a route path.
   *
   * `scope` is passed through exactly as the caller gave it, `undefined`
   * included - see {@link CachePathScope} for why an adapter must not substitute
   * a default of its own.
   */
  readonly expirePath: (
    path: string,
    scope: CachePathScope | undefined,
  ) => void;
  /**
   * Expires every stored entry carrying any of these tags.
   *
   * The list is never empty - {@link CacheExpiryOptions} arrives resolved, so an
   * adapter never has to guess a default or handle a no-op call.
   */
  readonly expireTags: (
    tags: readonly string[],
    options: CacheExpiryOptions,
  ) => void;
  /** Identifies the adapter in errors and tests. */
  readonly name: string;
  /** Declares how long the entry being produced stays useful. */
  readonly setEntryLife: (profile: CacheLifeProfile) => void;
  /** Tags the entry being produced, so an expiry can find it later. */
  readonly tagEntry: (tags: readonly string[]) => void;
}
