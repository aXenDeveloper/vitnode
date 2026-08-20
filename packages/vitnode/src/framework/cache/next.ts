import "server-only";
import * as nextCache from "next/cache";

import type { CacheAdapter } from "./types";

/**
 * The Next.js cache adapter - the **only** module in `@vitnode/core` that
 * imports `next/cache`.
 *
 * That is the whole point of the `framework/cache` layer: core code expires
 * entries through {@link CacheAdapter}, and swapping host frameworks means
 * writing a sibling of this file rather than editing forty call sites.
 * `framework/cache/boundaries.test.ts` asserts the rule instead of trusting it,
 * and `server-only` here keeps the whole layer out of client bundles.
 *
 * ## Why a namespace import
 *
 * `import * as nextCache` rather than named imports, because several suites
 * exercise one cache verb and mock `next/cache` with a factory holding only the
 * function they care about. Named imports are resolved when this module is
 * evaluated, so a partial mock would fail the *import* over a function the test
 * never calls. A namespace access fails only if that function is actually
 * reached, which is the behaviour a partial mock is asking for.
 */
export const nextCacheAdapter: CacheAdapter = {
  /**
   * `scope` is forwarded as given, `undefined` included.
   *
   * Not a defaulting oversight: Next builds the implicit tag for a path expiry
   * out of the path *and* the type, so `revalidatePath("/x", "page")` targets a
   * different key than `revalidatePath("/x")`. Substituting a default here would
   * quietly point every unscoped caller at entries it never meant.
   */
  expirePath: (path, scope) => {
    if (scope === undefined) {
      nextCache.revalidatePath(path);

      return;
    }

    nextCache.revalidatePath(path, scope);
  },

  /**
   * One call per tag, because that is the shape Next's API takes - both
   * `updateTag` and `revalidateTag` are single-tag functions.
   *
   * The three-way choice is Next's, not the contract's:
   *
   * - **stale-while-revalidate** is `revalidateTag(tag, "max")`. The bare
   *   one-argument form is deprecated - it warns, and means immediate - so the
   *   profile is always named.
   * - **immediate from a Server Action** is `updateTag`, the only one that gives
   *   the user who submitted the mutation read-your-own-writes.
   * - **immediate from a Route Handler** is `revalidateTag(tag, { expire: 0 })`.
   *   `updateTag` throws outside a Server Action, so the honest context matters:
   *   getting it wrong turns every background revalidation into a 500 rather
   *   than into a stale page.
   */
  expireTags: (tags, { context, mode }) => {
    for (const tag of tags) {
      if (mode !== "immediate") {
        nextCache.revalidateTag(tag, "max");
        continue;
      }

      if (context === "server-action") {
        nextCache.updateTag(tag);
        continue;
      }

      nextCache.revalidateTag(tag, { expire: 0 });
    }
  },

  name: "next",

  setEntryLife: profile => {
    nextCache.cacheLife(profile);
  },

  /**
   * Synchronous and variadic, straight through to `cacheTag`.
   *
   * Both this and `setEntryLife` read the work-unit store Next keeps in
   * async-local storage, which a synchronous call from inside the `"use cache"`
   * function still sees - so the indirection is free. What would break it is an
   * `await` on the way in, which is why neither returns a promise.
   */
  tagEntry: tags => {
    nextCache.cacheTag(...tags);
  },
};
