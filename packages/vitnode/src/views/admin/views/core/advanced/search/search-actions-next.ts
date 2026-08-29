"use client";

import { useRouter } from "@/lib/navigation";

import type { SearchIndexActions } from "./search-index-mutations";

import {
  clearSearchCollectionMutation,
  rebuildSearchIndexMutation,
} from "./mutation-api.server";

/**
 * The two search-index mutations, as the Next.js AdminCP performs them.
 *
 * The server actions unchanged - including the `updateTag(SEARCH_FEED_TAG)` that
 * expires the public browse feed, which only exists in Next.js - with
 * `router.refresh()` folded in on success, because that is how a Next.js page
 * re-reads the status it just changed.
 *
 * A hook rather than two module-scope functions: `router.refresh()` needs the
 * router, and the router needs a component. It is the mirror image of
 * `useSearchIndexActions` in `@vitnode/core/tanstack/admin/search-index`, which
 * invalidates a query instead. Both satisfy {@link SearchIndexActions}, which is
 * what lets one screen be rendered by either.
 *
 * Not memoised, and it does not need to be: the callbacks are read inside event
 * handlers rather than compared as props, and the components that take them hold
 * no state keyed on their identity.
 */
export const useSearchIndexActionsNext = (): SearchIndexActions => {
  const router = useRouter();

  return {
    clearCollection: async itemType => {
      const result = await clearSearchCollectionMutation(itemType);

      if (!result.error) router.refresh();

      return result;
    },
    rebuild: async itemType => {
      const result = await rebuildSearchIndexMutation(itemType);

      if (!result.error) router.refresh();

      return result;
    },
  };
};
