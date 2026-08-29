import "@tanstack/react-start/server-only";

import type { AdminUserFetcher } from "@/views/admin/views/core/users/detail/user-query";
import type {
  AdminUsersPageFetcher,
  AdminUsersParams,
} from "@/views/admin/views/core/users/list/users-query";

import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { adminUserRequest } from "@/views/admin/views/core/users/detail/user-query";
import {
  adminModuleRef,
  adminUsersRequest,
} from "@/views/admin/views/core/users/list/users-query";

import { fetcherServer } from "../../fetcher/server";

/**
 * The AdminCP users reads, during SSR.
 *
 * The requests and the refusal checks are the shared ones - the same the browser
 * fetchers use - so a page rendered on the server and one fetched after
 * hydration are the same request with the same failure semantics. Only the
 * *transport* is this module's.
 *
 * `fetcherServer` rather than a bare `fetch`, and here it is the whole point:
 * the admin API decides who is asking from the `Cookie` header, so a render that
 * forwarded nothing would be answered `403` for every administrator. It also
 * resolves the API origin from the request being rendered, so a preview
 * deployment calls its own hostname.
 *
 * Only ever reached through the isomorphic transports in `./query`, which is
 * what keeps this module - and the `server-only` marker above it - out of the
 * browser bundle.
 */

export const fetchAdminUsersPageOnServer: AdminUsersPageFetcher = async (
  params: AdminUsersParams,
) => {
  const response = await fetcherServer(
    adminModuleRef,
    adminUsersRequest(params),
  );

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the users list",
      describeAdminParams(params),
    );
  }

  return await response.json();
};

export const fetchAdminUserOnServer: AdminUserFetcher = async (id: string) => {
  const response = await fetcherServer(adminModuleRef, adminUserRequest(id));

  if (!response.ok) {
    throw new AdminRequestError(response.status, "a user", `id=${id}`);
  }

  return await response.json();
};
