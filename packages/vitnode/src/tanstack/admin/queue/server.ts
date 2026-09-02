import "@tanstack/react-start/server-only";

import type { QueueParams } from "@/views/admin/views/core/advanced/queue/queue-query";

import { queueAdminModule } from "@/api/modules/admin/advanced/queue/queue.admin.module";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { QUEUE_PREFIX_PATH } from "@/views/admin/views/core/advanced/queue/queue-query";

import { fetcher } from "../../fetcher/server";

export const fetchQueuePageOnServer = async (params: QueueParams) => {
  const response = await fetcher(queueAdminModule, {
    args: { query: params },
    method: "get",
    module: "queue",
    path: "/",
    prefixPath: QUEUE_PREFIX_PATH,
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the queue list",
      describeAdminParams(params),
    );
  }

  return await response.json();
};
