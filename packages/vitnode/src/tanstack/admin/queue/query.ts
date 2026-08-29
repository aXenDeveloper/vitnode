import { createIsomorphicFn } from "@tanstack/react-start";

import type {
  QueuePageFetcher,
  QueueParams,
} from "@/views/admin/views/core/advanced/queue/queue-query";

import {
  fetchQueuePageInBrowser,
  queueQueryOptions,
} from "@/views/admin/views/core/advanced/queue/queue-query";

import { fetchQueuePageOnServer } from "./server";

/**
 * The queue list for a TanStack Start host: one query definition, and no
 * mutation - this screen only reads.
 *
 * The transport boundary is the same one every AdminCP read uses: both branches
 * call Hono directly, with no `createServerFn` in between, because a server
 * function would be a `POST` back to the app that then calls Hono - two round
 * trips for a read the API is already the boundary for. See
 * `tanstack/admin/cron/query.ts` for the full argument, including why the
 * chained call has to be written out here rather than hidden behind a helper.
 */
const fetchQueuePage: QueuePageFetcher = createIsomorphicFn()
  .server(fetchQueuePageOnServer)
  .client(fetchQueuePageInBrowser);

/**
 * The queue list, as the one query definition every caller shares.
 *
 * `params` must be the *normalised* ones, because the cache key is built from
 * them - the status filter included, since two filters are two different sets of
 * rows.
 */
export const queueQuery = ({ params }: { params: QueueParams }) =>
  queueQueryOptions({ fetchPage: fetchQueuePage, params });
