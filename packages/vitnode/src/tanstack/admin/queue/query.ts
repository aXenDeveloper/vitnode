import type { QueueParams } from "@/views/admin/views/core/advanced/queue/queue-query";

import {
  fetchQueuePage,
  queueQueryOptions,
} from "@/views/admin/views/core/advanced/queue/queue-query";

export const queueQuery = ({ params }: { params: QueueParams }) =>
  queueQueryOptions({ fetchPage: fetchQueuePage, params });
