import { queryOptions } from "@tanstack/react-query";

import type { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import type {
  AdminTableContract,
  AdminTablePage,
  AdminTableParams,
} from "@/views/admin/table/params";
import type { QueueStatus } from "@/views/admin/views/core/advanced/queue/queue-query";

import { fetcherClient } from "@/lib/fetcher-client";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import {
  adminModuleRef,
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

/**
 * The two reads behind `/admin/core/debug`: the system log, and a snapshot of
 * the queue.
 *
 * They live in one module because they are one screen and share one permission -
 * both routes declare
 * `adminStaffPermission: { module: "debug", permission: "can_view" }` - but they
 * are two cache entries, because the log pages and the snapshot does not.
 *
 * The queue snapshot here is *not* the queue list at
 * `/admin/core/advanced/queue`: that one is paginated, filterable and gated on
 * `queue.can_view`; this one is four counters and whatever is currently pending
 * or processing, gated on `debug.can_view`. Two endpoints, two permissions, two
 * cache entries.
 */

export const debugAdminModuleRef = adminModuleRef<typeof debugAdminModule>();

/** The debug module is mounted under `/admin`, not at the plugin root. */
const DEBUG_PREFIX_PATH = "/admin";

// ------------------------------------------------------------ system log ---

export const DEBUG_LOGS_ORDER_BY = ["type", "createdAt", "pluginId"] as const;
export type DebugLogsOrderBy = (typeof DEBUG_LOGS_ORDER_BY)[number];

/** The log table's URL contract: three sortable columns, no search, no filter. */
export const DEBUG_LOGS_TABLE_CONTRACT: AdminTableContract<DebugLogsOrderBy> = {
  orderBy: DEBUG_LOGS_ORDER_BY,
};

export type DebugLogsParams = AdminTableParams<DebugLogsOrderBy>;

/** One row of the log table, as JSON delivers it. */
export interface DebugLogRow {
  content: string;
  createdAt: Date | string;
  id: number;
  ipAddress: string;
  method: string;
  path: string;
  pluginId: string;
  statusCode: number;
  type: "debug" | "error" | "warn";
  user: null | { id: number; name: string; nameCode: string };
  userAgent: null | string;
}

export type DebugLogsPage = AdminTablePage<DebugLogRow>;

/** One page of the log, as arguments to whichever fetcher is carrying it. */
export const debugLogsRequest = (params: DebugLogsParams) =>
  ({
    args: { query: params },
    method: "get" as const,
    module: "debug" as const,
    path: "/logs" as const,
    prefixPath: DEBUG_PREFIX_PATH,
  }) as const;

export type DebugLogsPageFetcher = (
  params: DebugLogsParams,
) => Promise<DebugLogsPage>;

/** One page of the log, fetched from the browser. */
export const fetchDebugLogsPageInBrowser: DebugLogsPageFetcher =
  async params => {
    const response = await fetcherClient(
      debugAdminModuleRef,
      debugLogsRequest(params),
    );

    if (!response.ok) {
      throw new AdminRequestError(
        response.status,
        "the system log",
        describeAdminParams(params),
      );
    }

    return await response.json();
  };

/** The root every cached page of the system log hangs off. */
export const debugLogsQueryRoot = adminQueryRoot("debug-logs");

export const debugLogsQueryKey = (params: DebugLogsParams) =>
  [...debugLogsQueryRoot, params] as const;

/**
 * The system log, as the one query definition every caller shares.
 *
 * `retry: false`, for the reason every AdminCP read refuses to retry.
 */
export const debugLogsQueryOptions = ({
  fetchPage = fetchDebugLogsPageInBrowser,
  params,
}: {
  fetchPage?: DebugLogsPageFetcher;
  params: DebugLogsParams;
}) =>
  queryOptions({
    queryFn: async () => await fetchPage(params),
    queryKey: debugLogsQueryKey(params),
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - Log lines arrive on their own; coming back to an empty log that has since filled is the failure. */
    staleTime: OPERATIONAL_STALE_TIME,
  });

// --------------------------------------------------------- queue snapshot ---

/** One task currently pending or processing. */
export interface DebugQueueTask {
  attempts: number;
  availableAt: Date | string;
  createdAt: Date | string;
  id: number;
  maxAttempts: number;
  name: string;
  pluginId: string;
  /** The queue's *name*, not a status - a task is dispatched onto one. */
  queue: string;
  status: QueueStatus;
}

/** The snapshot, exactly as the route's `200` schema declares it. */
export interface DebugQueueSnapshot {
  active: DebugQueueTask[];
  counts: {
    completed: number;
    failed: number;
    pending: number;
    processing: number;
  };
}

/** The read, as arguments to whichever fetcher is carrying it. */
export const debugQueueRequest = {
  method: "get" as const,
  module: "debug" as const,
  path: "/queue" as const,
  prefixPath: DEBUG_PREFIX_PATH,
} as const;

export type DebugQueueFetcher = () => Promise<DebugQueueSnapshot>;

/** The snapshot, fetched from the browser. */
export const fetchDebugQueueInBrowser: DebugQueueFetcher = async () => {
  const response = await fetcherClient(debugAdminModuleRef, debugQueueRequest);

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the queue snapshot");
  }

  return await response.json();
};

/** The cache entry the queue snapshot reads and writes. */
export const debugQueueQueryKey = adminQueryRoot("debug-queue");

export const debugQueueQueryOptions = ({
  fetchSnapshot = fetchDebugQueueInBrowser,
}: {
  fetchSnapshot?: DebugQueueFetcher;
} = {}) =>
  queryOptions({
    queryFn: async () => await fetchSnapshot(),
    queryKey: debugQueueQueryKey,
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - The queue snapshot is a live figure, not a record somebody edited. */
    staleTime: OPERATIONAL_STALE_TIME,
  });
