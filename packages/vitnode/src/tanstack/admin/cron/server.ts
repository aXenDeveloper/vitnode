import "@tanstack/react-start/server-only";

import type {
  CronPageFetcher,
  CronParams,
} from "@/views/admin/views/core/advanced/cron/cron-query";

import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import {
  cronAdminModuleRef,
  cronRequest,
} from "@/views/admin/views/core/advanced/cron/cron-query";

import { fetcherServer } from "../../fetcher/server";

/**
 * One page of the cron list, fetched during SSR.
 *
 * The request and the refusal check are the shared ones - the same two the
 * browser fetcher uses - so a page rendered on the server and a page fetched
 * after hydration are the same request with the same failure semantics. Only
 * the *transport* is this module's, and it is the only part that genuinely
 * cannot be shared.
 *
 * `fetcherServer` rather than a bare `fetch`, and here that is not a nicety: the
 * admin API decides who is asking from the `Cookie` header. A render that
 * forwarded nothing would be answered as an anonymous visitor - `403` - so this
 * is the difference between an AdminCP screen and an error. It also resolves the
 * API origin from the request being rendered, so a preview deployment calls its
 * own hostname.
 *
 * Only ever reached through the isomorphic transport in `./query`, which is what
 * keeps this module - and the `server-only` marker above it - out of the browser
 * bundle.
 */
export const fetchCronPageOnServer: CronPageFetcher = async (
  params: CronParams,
) => {
  const response = await fetcherServer(cronAdminModuleRef, cronRequest(params));

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the cron list",
      describeAdminParams(params),
    );
  }

  return await response.json();
};
