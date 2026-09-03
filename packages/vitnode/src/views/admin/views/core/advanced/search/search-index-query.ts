import { queryOptions } from "@tanstack/react-query";

import type { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import type { UniversalFetcher } from "@/lib/fetcher-client";

import { fetcherClient } from "@/lib/fetcher-client";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { adminModuleRef, AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";
import { ADMIN_DEBUG_PREFIX_PATH } from "@/views/admin/views/core/system/integrations/integrations-query";

import type { SearchCollection } from "./collection-status";
import type { SearchSyncError } from "./sync-errors";

export const searchDebugAdminModuleRef =
  adminModuleRef<typeof debugAdminModule>();

export interface SearchIndexStatus {
  collections: SearchCollection[];
  engine: string;
  /** `false` when nothing is scheduled to drain the reindex queue. */
  hasCronAdapter: boolean;
  healthy: boolean;
  lastIndexedAt: Date | null | string;
  syncErrors: SearchSyncError[];
  total: number;
}

/** The read, as arguments to whichever fetcher is carrying it. */
/** How the status is actually fetched. */
export type SearchIndexStatusFetcher = () => Promise<SearchIndexStatus>;

/** The status, over whichever transport the host hands in. */
export const searchIndexStatusFetcher =
  (transport: UniversalFetcher): SearchIndexStatusFetcher =>
  async () => {
    const response = await transport(searchDebugAdminModuleRef, {
      method: "get",
      module: "debug",
      path: "/search/status",
      prefixPath: ADMIN_DEBUG_PREFIX_PATH,
    });

    if (!response.ok) {
      throw new AdminRequestError(response.status, "the search index status");
    }

    return await response.json();
  };

/** The status, fetched from the browser. */
export const fetchSearchIndexStatusInBrowser: SearchIndexStatusFetcher =
  searchIndexStatusFetcher(fetcherClient);

/** The cache entry this screen reads and writes. */
export const searchIndexQueryKey = adminQueryRoot("search-index");

export const searchIndexQueryOptions = ({
  fetchStatus = fetchSearchIndexStatusInBrowser,
}: {
  fetchStatus?: SearchIndexStatusFetcher;
} = {}) =>
  queryOptions({
    queryFn: async () => await fetchStatus(),
    queryKey: searchIndexQueryKey,
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - A re-index makes progress on its own, which is the whole thing this screen reports. */
    staleTime: OPERATIONAL_STALE_TIME,
  });
