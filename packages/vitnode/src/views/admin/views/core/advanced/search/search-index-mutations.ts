import { fetcherClient } from "@/lib/fetcher-client";

import { searchDebugAdminModuleRef } from "./search-index-query";

/**
 * The two things this screen can do to the index, as contracts both frameworks
 * satisfy.
 *
 * Both endpoints declare
 * `adminStaffPermission: { module: "system", permission: "can_view" }` and
 * re-check it on every request, so the browser may call them directly.
 *
 * ## Each callback refreshes on success, and that is part of the contract
 *
 * Both mutations change what the status read reports, so the screen has to
 * re-read it - and *how* is the one genuinely framework-shaped step:
 * `router.refresh()` in Next.js, a query invalidation in TanStack Start. Folding
 * it into the callback rather than passing a second `onRefresh` prop is what
 * keeps the buttons below identical in both: they await one function and then
 * show a toast.
 *
 * The Next.js side additionally expires the public browse feed's cache tag
 * (`updateTag(SEARCH_FEED_TAG)`), because `/search` and `/discover` are cached
 * reads of this index there. A TanStack Start host has no such cache, so there
 * is nothing to expire - see `tanstack/admin/search-index/query.ts`.
 */

/** What a mutation reports back. `error` is the API's own text. */
export interface SearchIndexMutationResult {
  data?: unknown;
  error?: string;
}

/** Queue a rebuild - of one collection, or of everything when given no id. */
export type RebuildSearchIndex = (
  itemType?: string,
) => Promise<SearchIndexMutationResult>;

/**
 * Drop the documents of a collection with no rebuild indexer.
 *
 * Destructive: nothing rebuilds them afterwards, though the owning plugin may
 * write them again live. The API refuses it for any collection that *has* an
 * indexer, which is why the table offers this and "reindex" as alternatives
 * rather than as a pair.
 */
export type ClearSearchCollection = (
  itemType: string,
) => Promise<SearchIndexMutationResult>;

/** The pair, as the screen and its three buttons pass them around. */
export interface SearchIndexActions {
  clearCollection: ClearSearchCollection;
  rebuild: RebuildSearchIndex;
}

/**
 * Queues a rebuild from the browser.
 *
 * Never rejects: a refusal is something the administrator has to be told in a
 * toast, and `rawApiFetch` throws on a `500` with the server's own error text,
 * which has already been logged where a log belongs.
 */
export const rebuildSearchIndexInBrowser: RebuildSearchIndex =
  async itemType => {
    try {
      const response = await fetcherClient(searchDebugAdminModuleRef, {
        args: { body: itemType ? { itemType } : {} },
        method: "post",
        module: "debug",
        options: { credentials: "include" },
        path: "/search/rebuild",
        prefixPath: "/admin",
      });

      if (!response.ok) return { error: await response.text() };

      return { data: await response.json() };
    } catch {
      return { error: "Failed to queue the rebuild." };
    }
  };

/** Drops one collection's documents from the browser. */
export const clearSearchCollectionInBrowser: ClearSearchCollection =
  async itemType => {
    try {
      const response = await fetcherClient(searchDebugAdminModuleRef, {
        args: { body: { itemType } },
        method: "post",
        module: "debug",
        options: { credentials: "include" },
        path: "/search/clear",
        prefixPath: "/admin",
      });

      if (!response.ok) return { error: await response.text() };

      return { data: await response.json() };
    } catch {
      return { error: "Failed to remove the documents." };
    }
  };
