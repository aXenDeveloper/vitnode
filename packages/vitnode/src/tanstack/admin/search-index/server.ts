import "@tanstack/react-start/server-only";

import type { SearchIndexStatusFetcher } from "@/views/admin/views/core/advanced/search/search-index-query";

import { AdminRequestError } from "@/views/admin/admin-request";
import {
  searchDebugAdminModuleRef,
  searchIndexStatusRequest,
} from "@/views/admin/views/core/advanced/search/search-index-query";

import { fetcherServer } from "../../fetcher/server";

/**
 * The search index's status, fetched during SSR.
 *
 * The request and the refusal check are the shared ones; only the transport is
 * this module's. `fetcherServer` forwards the admin cookie the page request
 * arrived with, without which the API answers `403`. Reached only through
 * `./query`'s isomorphic function, so the `server-only` marker above never
 * reaches the browser bundle.
 */
export const fetchSearchIndexStatusOnServer: SearchIndexStatusFetcher =
  async () => {
    const response = await fetcherServer(
      searchDebugAdminModuleRef,
      searchIndexStatusRequest,
    );

    if (!response.ok) {
      throw new AdminRequestError(response.status, "the search index status");
    }

    return await response.json();
  };
