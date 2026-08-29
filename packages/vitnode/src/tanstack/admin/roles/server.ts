import "@tanstack/react-start/server-only";

import type {
  AdminRolesPageFetcher,
  AdminRolesParams,
} from "@/views/admin/views/core/users/roles/roles-query";

import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { adminModuleRef } from "@/views/admin/views/core/users/list/users-query";
import { adminRolesRequest } from "@/views/admin/views/core/users/roles/roles-query";

import { fetcherServer } from "../../fetcher/server";

/**
 * One page of the roles list, fetched during SSR.
 *
 * The request and the refusal check are the shared ones, so a page rendered on
 * the server and one fetched after hydration are the same request with the same
 * failure semantics. `fetcherServer` forwards the admin cookie the page request
 * arrived with, which is the difference between an AdminCP screen and a `403`.
 *
 * Only ever reached through the isomorphic transport in `./query`, which keeps
 * this module - and the `server-only` marker above it - out of the browser
 * bundle.
 */
export const fetchAdminRolesPageOnServer: AdminRolesPageFetcher = async (
  params: AdminRolesParams,
) => {
  const response = await fetcherServer(
    adminModuleRef,
    adminRolesRequest(params),
  );

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the roles list",
      describeAdminParams(params),
    );
  }

  return await response.json();
};
