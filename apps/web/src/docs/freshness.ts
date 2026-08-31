/**
 * How long a documentation build stays true, and the two places that answer
 * differently in development.
 *
 * In production the answer is "forever": `content/docs` is build output, frozen
 * when the server started, and the page tree, the search index and
 * `/llms-full.txt` are all derived from it. Computing any of them twice is
 * waste.
 *
 * While somebody is *writing* documentation the answer is the opposite, and the
 * cost of getting it wrong is a dev server that has to be restarted to see a
 * renamed page. Both policies live here rather than being spelled out at each
 * of the three call sites, because "how fresh is the documentation" is one
 * question and it was about to be answered three ways.
 *
 * It is deliberately app-local. `@vitnode/core` is externalised from this app's
 * SSR pass and is built once for every host; `import.meta.env` is this build's,
 * and a package that branched on it would be branching on whoever bundled it.
 */

/**
 * How long the router may reuse a loaded page tree - `_docs`'s `staleTime`.
 *
 * `Infinity` in production, because the tree is a constant: identical for every
 * visitor, unchanged for the life of the process, and refetching it on every
 * navigation inside the documentation would be a round trip for something that
 * cannot have changed.
 *
 * `0` in development, so that adding a page, renaming one or editing a
 * `meta.json` shows up in the sidebar on the next navigation instead of on the
 * next server restart. The loader re-runs, the server function runs again, and
 * Vite has by then re-executed the collection - see {@link memoizePerSource} for
 * why that last step is what actually makes the answer new.
 */
export const DOCS_TREE_STALE_TIME = import.meta.env.PROD ? Infinity : 0

/**
 * Compute something from the documentation source once per *version* of that
 * source.
 *
 * The search index and `/llms-full.txt` are both expensive, both derived from
 * the whole collection, and both were memoized in a module-level `let` - which
 * is right in production and wrong for the rest of the time: the promise
 * outlives every edit, so a dev server keeps answering with the documentation it
 * read at boot.
 *
 * The fix is not a flag. It is to notice that the thing being cached is a
 * function *of the source module*, and to key the cache on that module:
 *
 *     production   one module instance for the process -> computed once
 *     development  Vite re-executes the collection when `content/docs` changes,
 *                  which produces a new module namespace -> computed again
 *
 * So one mechanism gives both behaviours, and neither of them is a guess about
 * the environment. A repeated search between two edits still reuses the index -
 * the module has not been replaced, so the key has not changed - which is the
 * half a plain "recompute in dev" would have thrown away.
 *
 * A `WeakMap` rather than a `Map` because the key is the previous module
 * namespace: after an edit nothing references it any more, and holding the index
 * built from a document somebody has already changed is how a dev server grows
 * for an afternoon.
 *
 * `loadSource` is a parameter rather than a hard-coded import, for two reasons.
 * It makes this testable without Vite and without the documentation - see
 * `src/tests/docs-freshness.test.ts`. And it keeps this module client-safe:
 * `_docs.tsx` imports {@link DOCS_TREE_STALE_TIME} from here, so an
 * `import("./source.server")` written *in this file* would put the whole content
 * index in the browser build as a lazy chunk. The two server routes pass their
 * own loader, and Start prunes those route files out of the client tree
 * entirely.
 */
export const memoizePerSource = <TSource extends object, TValue>(
  loadSource: () => Promise<TSource>,
  compute: (source: TSource) => Promise<TValue>,
): (() => Promise<TValue>) => {
  const cache = new WeakMap<TSource, Promise<TValue>>()

  return async (): Promise<TValue> => {
    const source = await loadSource()
    const cached = cache.get(source)

    if (cached) return await cached

    // Stored before it is awaited, so two simultaneous first requests build one
    // index rather than two.
    const value = compute(source)
    cache.set(source, value)

    return await value
  }
}
