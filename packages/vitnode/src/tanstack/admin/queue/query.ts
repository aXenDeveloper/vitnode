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

const fetchQueuePage: QueuePageFetcher = createIsomorphicFn()
  .server(fetchQueuePageOnServer)
  .client(fetchQueuePageInBrowser);

export const queueQuery = ({ params }: { params: QueueParams }) =>
  queueQueryOptions({ fetchPage: fetchQueuePage, params });
