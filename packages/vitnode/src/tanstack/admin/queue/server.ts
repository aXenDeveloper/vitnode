import "@tanstack/react-start/server-only";

import type {
  QueuePageFetcher,
  QueueParams,
} from "@/views/admin/views/core/advanced/queue/queue-query";

import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import {
  queueAdminModuleRef,
  queueRequest,
} from "@/views/admin/views/core/advanced/queue/queue-query";

import { fetcherServer } from "../../fetcher/server";

/**
 * One page of the queue list, fetched during SSR.
 *
 * The request and the refusal check are the shared ones, so a page rendered on
 * the server and a page fetched after hydration are the same request with the
 * same failure semantics. Only the transport is this module's.
 *
 * `fetcherServer` forwards the admin cookie the page request arrived with and
 * resolves the API origin from that request - see `tanstack/admin/cron/server.ts`
 * for the full argument. Reached only through `./query`'s isomorphic function,
 * which is what keeps the `server-only` marker above out of the browser bundle.
 */
export const fetchQueuePageOnServer: QueuePageFetcher = async (
  params: QueueParams,
) => {
  const response = await fetcherServer(
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
