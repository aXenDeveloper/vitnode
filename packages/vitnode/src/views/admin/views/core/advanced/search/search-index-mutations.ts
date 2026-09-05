import { fetcherClient } from "@/lib/fetcher-client";

import { searchDebugAdminModuleRef } from "./search-index-query";

/** What a mutation reports back. `error` is the API's own text. */
export interface SearchIndexMutationResult {
  data?: unknown;
  error?: string;
}

/** Queue a rebuild - of one collection, or of everything when given no id. */
export type RebuildSearchIndex = (
  itemType?: string,
) => Promise<SearchIndexMutationResult>;

export type ClearSearchCollection = (
  itemType: string,
) => Promise<SearchIndexMutationResult>;

/** The pair, as the screen and its three buttons pass them around. */
export interface SearchIndexActions {
  clearCollection: ClearSearchCollection;
  rebuild: RebuildSearchIndex;
}

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
