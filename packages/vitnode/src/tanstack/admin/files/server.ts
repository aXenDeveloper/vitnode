import "@tanstack/react-start/server-only";

import type {
  AdminFilesPageFetcher,
  AdminFilesParams,
} from "@/views/admin/views/core/system/files/files-query";

import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import {
  adminFilesRequest,
  filesAdminModuleRef,
} from "@/views/admin/views/core/system/files/files-query";

import { fetcherServer } from "../../fetcher/server";

/**
 * One page of the uploaded-file list, fetched during SSR.
 *
 * `fetcherServer` forwards the admin cookie the page request arrived with, which
 * here is the difference between the AdminCP's file list and a `403`. Reached
 * only through `./query`'s isomorphic function, so this module - and the
 * `server-only` marker above it - never reaches the browser bundle.
 */
export const fetchAdminFilesPageOnServer: AdminFilesPageFetcher = async (
  params: AdminFilesParams,
) => {
  const response = await fetcherServer(
    filesAdminModuleRef,
    adminFilesRequest(params),
  );

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "the uploaded files list",
      describeAdminParams(params),
    );
  }

  return await response.json();
};
