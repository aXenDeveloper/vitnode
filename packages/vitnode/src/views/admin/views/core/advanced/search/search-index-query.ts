import { queryOptions } from "@tanstack/react-query";

import { CONFIG_PLUGIN } from "@/config";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

import type { SearchCollection } from "./collection-status";
import type { SearchSyncError } from "./sync-errors";

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
export const fetchSearchIndexStatus: SearchIndexStatusFetcher = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "admin/debug",
    path: "/search/status",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the search index status");
  }

  return await response.json();
};

/** The cache entry this screen reads and writes. */
export const searchIndexQueryKey = adminQueryRoot("search-index");

export const searchIndexQueryOptions = ({
  fetchStatus = fetchSearchIndexStatus,
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
