import "@tanstack/react-start/server-only";

import type {
  DebugLogsPageFetcher,
  DebugLogsParams,
  DebugQueueFetcher,
} from "@/views/admin/views/core/debug/debug-query";

import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import {
  debugAdminModuleRef,
  debugLogsRequest,
  debugQueueRequest,
} from "@/views/admin/views/core/debug/debug-query";

import { fetcherServer } from "../../fetcher/server";

/**
 * The debug panel's two reads, during SSR.
 *
 * The requests and the refusal checks are the shared ones; only the transport is
 * this module's. `fetcherServer` forwards the admin cookie the page request
 * arrived with, without which the API answers `403`. Reached only through
 * `./query`'s isomorphic functions, so the `server-only` marker above never
 * reaches the browser bundle.
 */

export const fetchDebugLogsPageOnServer: DebugLogsPageFetcher = async (
  params: DebugLogsParams,
) => {
  const response = await fetcherServer(
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

export const fetchDebugQueueOnServer: DebugQueueFetcher = async () => {
  const response = await fetcherServer(debugAdminModuleRef, debugQueueRequest);

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the queue snapshot");
  }

  return await response.json();
};
