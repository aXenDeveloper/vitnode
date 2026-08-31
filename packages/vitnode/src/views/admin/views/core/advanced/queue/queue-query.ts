import { queryOptions } from "@tanstack/react-query";

import type { queueAdminModule } from "@/api/modules/admin/advanced/queue/queue.admin.module";
import type {
  AdminTableContract,
  AdminTablePage,
  AdminTableParams,
} from "@/views/admin/table/params";

import { fetcherClient } from "@/lib/fetcher-client";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import {
  adminModuleRef,
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

/**
 * The AdminCP queue list, as one query definition.
 *
 * The same shape as the cron list beside it, with one extra parameter: the
 * `status` filter the toolbar writes. Everything about *what* the list is - the
 * request, the sortable columns, the filter's allowed values, the cache entry -
 * lives here, and both applications read through it.
 *
 * `GET /api/@vitnode/core/admin/advanced/queue` declares
 * `adminStaffPermission: { module: "queue", permission: "can_view" }` and
 * re-checks it on every request, so nothing below authorizes anything.
 */

export const queueAdminModuleRef = adminModuleRef<typeof queueAdminModule>();

/** The module is mounted under `/admin/advanced`, not at the plugin root. */
const QUEUE_PREFIX_PATH = "/admin/advanced";

/** The statuses a task can be in - `QUEUE_STATUSES` on `getQueueTasksRoute`. */
export const QUEUE_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const QUEUE_ORDER_BY = ["createdAt", "availableAt", "status"] as const;
export type QueueOrderBy = (typeof QUEUE_ORDER_BY)[number];

/**
 * The queue table's URL contract.
 *
 * `status` is declared so an unrecognised value is dropped here rather than sent
 * - the route splits the comma-separated list and ignores anything it does not
 * know, so `?status=nonsense` and no `status` are the same query and must be the
 * same cache entry.
 */
export const QUEUE_TABLE_CONTRACT: AdminTableContract<QueueOrderBy> = {
  orderBy: QUEUE_ORDER_BY,
  status: QUEUE_STATUSES,
};

export type QueueParams = AdminTableParams<QueueOrderBy>;

/** One row of the table, as JSON delivers it. */
export interface QueueTaskRow {
  attempts: number;
  availableAt: Date | string;
  completedAt: Date | null | string;
  createdAt: Date | string;
  id: number;
  lastError: null | string;
  maxAttempts: number;
  name: string;
  pluginId: string;
  priority: number;
  queue: string;
  reservedAt: Date | null | string;
  status: QueueStatus;
}

export type QueuePage = AdminTablePage<QueueTaskRow>;

/** One page of the list, as arguments to whichever fetcher is carrying it. */
export const queueRequest = (params: QueueParams) =>
  ({
    args: { query: params },
    method: "get" as const,
    module: "queue" as const,
    path: "/" as const,
    prefixPath: QUEUE_PREFIX_PATH,
  }) as const;

/** How a page is actually fetched. See {@link queueQueryOptions}. */
export type QueuePageFetcher = (params: QueueParams) => Promise<QueuePage>;

/** One page, fetched from the browser. */
export const fetchQueuePageInBrowser: QueuePageFetcher = async params => {
  const response = await fetcherClient(
    queueAdminModuleRef,
    queueRequest(params),
  );

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the queue list",
      describeAdminParams(params),
    );
  }

  return await response.json();
};

/** The root every cached page of the queue list hangs off. */
export const queueQueryRoot = adminQueryRoot("queue");

/**
 * The cache entry one page of the list reads and writes.
 *
 * The normalised parameters, which for this table includes the status filter -
 * two filters are two different sets of rows, so they have to be two entries.
 */
export const queueQueryKey = (params: QueueParams) =>
  [...queueQueryRoot, params] as const;

/**
 * The queue list, as the one query definition every caller shares.
 *
 * `retry: false` for the same reason the cron list refuses to retry: every
 * failure this read can produce is made worse by repeating it.
 */
export const queueQueryOptions = ({
  fetchPage = fetchQueuePageInBrowser,
  params,
}: {
  fetchPage?: QueuePageFetcher;
  params: QueueParams;
}) =>
  queryOptions({
    queryFn: async () => await fetchPage(params),
    queryKey: queueQueryKey(params),
    retry: false,
    /** {@link OPERATIONAL_STALE_TIME} - Jobs drain while the screen is open; a revisit should not show a queue that has already emptied. */
    staleTime: OPERATIONAL_STALE_TIME,
  });
