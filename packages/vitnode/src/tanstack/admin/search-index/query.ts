import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type {
  SearchIndexActions,
  SearchIndexMutationResult,
} from "@/views/admin/views/core/advanced/search/search-index-mutations";
import type { SearchIndexStatusFetcher } from "@/views/admin/views/core/advanced/search/search-index-query";

import {
  clearSearchCollectionInBrowser,
  rebuildSearchIndexInBrowser,
} from "@/views/admin/views/core/advanced/search/search-index-mutations";
import {
  fetchSearchIndexStatusInBrowser,
  searchIndexQueryKey,
  searchIndexQueryOptions,
} from "@/views/admin/views/core/advanced/search/search-index-query";

import { fetchSearchIndexStatusOnServer } from "./server";

/**
 * The search index screen for a TanStack Start host: one query definition and
 * the two mutations that make it stale.
 *
 * The transport boundary is the same one every AdminCP read uses - both branches
 * call Hono directly, and the admin cookie travels on both. See
 * `tanstack/admin/cron/query.ts` for the full argument.
 */
const fetchSearchIndexStatus: SearchIndexStatusFetcher = createIsomorphicFn()
  .server(fetchSearchIndexStatusOnServer)
  .client(fetchSearchIndexStatusInBrowser);

/** The status, as the one query definition the loader and the component share. */
export const searchIndexQuery = () =>
  searchIndexQueryOptions({ fetchStatus: fetchSearchIndexStatus });

/**
 * Marks the status stale, so the screen re-reads what a rebuild changed.
 *
 * One entry rather than a family: this screen is a single read, and the
 * collections table filters the list it already has rather than asking again.
 *
 * ## What this deliberately does not do
 *
 * The Next.js mutations also call `updateTag(SEARCH_FEED_TAG)`, which expires
 * the public browse feed - a *cached* read of this index in that application. A
 * TanStack Start host has no such cache: `/search` and `/discover` read the API
 * through TanStack Query on each visit, with the API's own caching underneath,
 * so there is no tag to expire and nothing to keep in step. Adding an
 * invalidation of the public feed's query here would refetch a list nobody is
 * looking at, in a different part of the application, on behalf of an
 * administrator who is looking at the AdminCP.
 */
export const invalidateSearchIndex = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: searchIndexQueryKey });

/**
 * The two mutations, bound to the mounted router's cache.
 *
 * The shape is the point: this satisfies `SearchIndexActions`, so
 * `SearchIndexContent` and its three buttons stay framework-neutral and a host
 * supplies the transport. Each callback refreshes on success - a query
 * invalidation - because the screen reports state the mutation just changed.
 *
 * Only on success. A refused rebuild changed nothing, and refetching the status
 * underneath the error toast would replace the numbers the administrator is
 * being told about.
 *
 * Memoised so the buttons' `useTransition` is not reset by a new function
 * identity mid-rebuild.
 */
export const useSearchIndexActions = (): SearchIndexActions => {
  const queryClient = useQueryClient();

  return React.useMemo<SearchIndexActions>(
    () => ({
      clearCollection: async (itemType: string) => {
        const result: SearchIndexMutationResult =
          await clearSearchCollectionInBrowser(itemType);

        if (!result.error) await invalidateSearchIndex(queryClient);

        return result;
      },
      rebuild: async (itemType?: string) => {
        const result: SearchIndexMutationResult =
          await rebuildSearchIndexInBrowser(itemType);

        if (!result.error) await invalidateSearchIndex(queryClient);

        return result;
      },
    }),
    [queryClient],
  );
};
