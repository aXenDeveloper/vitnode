import { queryOptions } from "@tanstack/react-query";

import type { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";

import { fetcherClient } from "@/lib/fetcher-client";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { adminModuleRef, AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

import type { SearchCollection } from "./collection-status";
import type { SearchSyncError } from "./sync-errors";

/**
 * The search index's health, as one query definition.
 *
 * One read of `GET /admin/debug/search/status`: which engine is active, whether
 * it is reachable, how much of each collection is indexed, when it last was, and
 * the ten most recent sync failures.
 *
 * The route declares `adminStaffPermission: { module: "system", permission:
 * "can_view" }` and re-checks it on every request, so nothing below authorizes
 * anything.
 */

export const searchDebugAdminModuleRef =
  adminModuleRef<typeof debugAdminModule>();

/**
 * The screen's data, exactly as the route's `200` schema declares it.
 *
 * Declared rather than inferred off the fetcher, because the inferred type
 * cannot be named across a declaration-emit boundary. `SearchCollection` and
 * `SearchSyncError` already existed for the table and the errors card, and they
 * are reused here rather than restated.
 */
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
export const searchIndexStatusRequest = {
  method: "get" as const,
  module: "debug" as const,
  path: "/search/status" as const,
  prefixPath: "/admin" as const,
} as const;

/** How the status is actually fetched. */
export type SearchIndexStatusFetcher = () => Promise<SearchIndexStatus>;

/** The status, fetched from the browser. */
export const fetchSearchIndexStatusInBrowser: SearchIndexStatusFetcher =
  async () => {
    const response = await fetcherClient(
      searchDebugAdminModuleRef,
      searchIndexStatusRequest,
    );

    if (!response.ok) {
      throw new AdminRequestError(response.status, "the search index status");
    }

    return await response.json();
  };

/** The cache entry this screen reads and writes. */
export const searchIndexQueryKey = adminQueryRoot("search-index");

/**
 * The search index status, as the one query definition every caller shares.
 *
 * `retry: false`. This screen exists to report whether the search engine is
 * healthy, and retrying a refused *status* read three times before saying so
 * makes the one page that should fail fast the slowest page in the panel.
 */
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
