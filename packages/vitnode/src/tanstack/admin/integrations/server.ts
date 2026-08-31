import "@tanstack/react-start/server-only";

import type { IntegrationsFetcher } from "@/views/admin/views/core/system/integrations/integrations-query";

import { AdminRequestError } from "@/views/admin/admin-request";
import {
  debugAdminModuleRef,
  integrationsRequest,
} from "@/views/admin/views/core/system/integrations/integrations-query";

import { fetcherServer } from "../../fetcher/server";

/**
 * The integrations board's data, fetched during SSR.
 *
 * The request and the refusal check are the shared ones; only the transport is
 * this module's. `fetcherServer` forwards the admin cookie the page request
 * arrived with, without which the API answers `403`. Reached only through
 * `./query`'s isomorphic function, so the `server-only` marker above never
 * reaches the browser bundle.
 */
export const fetchIntegrationsOnServer: IntegrationsFetcher = async () => {
  const response = await fetcherServer(
    debugAdminModuleRef,
    integrationsRequest,
  );

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the integrations board");
  }

  return await response.json();
};
