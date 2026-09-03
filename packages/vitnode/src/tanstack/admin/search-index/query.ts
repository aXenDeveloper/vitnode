import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type {
  SearchIndexActions,
  SearchIndexMutationResult,
} from "@/views/admin/views/core/advanced/search/search-index-mutations";
import type { SearchIndexStatusFetcher } from "@/views/admin/views/core/advanced/search/search-index-query";

import { fetcher } from "@/tanstack/fetcher";
import {
  clearSearchCollectionInBrowser,
  rebuildSearchIndexInBrowser,
} from "@/views/admin/views/core/advanced/search/search-index-mutations";
import {
  searchIndexQueryKey,
  searchIndexQueryOptions,
  searchIndexStatusFetcher,
} from "@/views/admin/views/core/advanced/search/search-index-query";

const fetchSearchIndexStatus: SearchIndexStatusFetcher =
  searchIndexStatusFetcher(fetcher);

/** The status, as the one query definition the loader and the component share. */
export const searchIndexQuery = () =>
  searchIndexQueryOptions({ fetchStatus: fetchSearchIndexStatus });

export const invalidateSearchIndex = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: searchIndexQueryKey });

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
