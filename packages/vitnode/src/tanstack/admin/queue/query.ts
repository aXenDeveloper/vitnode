import type {
  QueuePageFetcher,
  QueueParams,
} from "@/views/admin/views/core/advanced/queue/queue-query";

import { fetcher } from "@/tanstack/fetcher";
import {
  queuePageFetcher,
  queueQueryOptions,
} from "@/views/admin/views/core/advanced/queue/queue-query";

const fetchQueuePage: QueuePageFetcher = queuePageFetcher(fetcher);

export const queueQuery = ({ params }: { params: QueueParams }) =>
  queueQueryOptions({ fetchPage: fetchQueuePage, params });
