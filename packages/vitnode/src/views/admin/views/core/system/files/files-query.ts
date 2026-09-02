import { queryOptions } from "@tanstack/react-query";

import type { filesAdminModule } from "@/api/modules/admin/files/files.admin.module";
import type {
  AdminTableContract,
  AdminTablePage,
  AdminTableParams,
} from "@/views/admin/table/params";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import {
  adminModuleRef,
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

/**
 * Every file uploaded to the installation, as one query definition.
 *
 * The AdminCP's counterpart to `views/files/my-files-query.ts`, and deliberately
 * a separate one: that list is `GET /users/files`, scoped to the signed-in
 * visitor by their session cookie, and this is `GET /admin/files`, which returns
 * everybody's and is gated on `files.can_view`. Two endpoints, two permissions,
 * two cache families - sharing either would be a way for one to answer for the
 * other.
 *
 * `GET /api/@vitnode/core/admin/files` re-checks that permission against the
 * staff tables on every request, so nothing below authorizes anything.
 */

export const filesAdminModuleRef = adminModuleRef<typeof filesAdminModule>();

/** The module is mounted under `/admin`, not at the plugin root. */
export const ADMIN_FILES_PREFIX_PATH = "/admin";

export const ADMIN_FILES_ORDER_BY = ["name", "size", "createdAt"] as const;
export type AdminFilesOrderBy = (typeof ADMIN_FILES_ORDER_BY)[number];

/** The table's URL contract: three sortable columns and a search box. */
export const ADMIN_FILES_TABLE_CONTRACT: AdminTableContract<AdminFilesOrderBy> =
  {
    orderBy: ADMIN_FILES_ORDER_BY,
    search: true,
  };

export type AdminFilesParams = AdminTableParams<AdminFilesOrderBy>;

/** The uploader, or `null` for an anonymous upload or a deleted account. */
export interface AdminFileUploader {
  id: number;
  name: string;
  nameCode: string;
  role: {
    color: null | string;
    id: number;
    name: { languageCode: string; name: string }[];
  };
}

/** One row of the table, as JSON delivers it. */
export interface AdminFileRow {
  /** ISO string over the wire; a `Date` when a Next.js render passes it in. */
  createdAt: Date | string;
  dimensions: null | { height: number; width: number };
  folder: string;
  id: number;
  metadata: Record<string, unknown>;
  mimeType: null | string;
  name: string;
  size: number;
  /** `null` when no storage adapter is configured, so there is nothing to link. */
  url: null | string;
  user: AdminFileUploader | null;
}

export type AdminFilesPage = AdminTablePage<AdminFileRow>;

/** One page of the list, as arguments to whichever fetcher is carrying it. */
/** How a page is actually fetched. See {@link adminFilesQueryOptions}. */
export type AdminFilesPageFetcher = (
  params: AdminFilesParams,
) => Promise<AdminFilesPage>;

/** One page, fetched from the browser. */
export const fetchAdminFilesPageInBrowser: AdminFilesPageFetcher =
  async params => {
    const response = await fetcherClient(filesAdminModuleRef, {
      args: { query: params },
      method: "get",
      module: "files",
      path: "/",
      prefixPath: ADMIN_FILES_PREFIX_PATH,
    });

    if (!response.ok) {
      throw new AdminRequestError(
        response.status,
        "the uploaded files list",
        describeAdminParams(params),
      );
    }

    return await response.json();
  };

/** The root every cached page of the admin file list hangs off. */
export const adminFilesQueryRoot = adminQueryRoot("files");

/**
 * The cache entry one page of the list reads and writes.
 *
 * The normalised parameters, search included. No owner segment, and that is the
 * difference from `/files`: this list is not partitioned by who is looking at
 * it, because it is not their data - it is the installation's, and everyone who
 * can open the screen sees the same rows. `removeAdminShellQueries` is what
 * takes it out of the browser at sign-out.
 */
export const adminFilesQueryKey = (params: AdminFilesParams) =>
  [...adminFilesQueryRoot, params] as const;

/**
 * The admin file list, as the one query definition every caller shares.
 *
 * `retry: false`, for the reason every AdminCP read refuses to retry: a `429` is
 * answered by sending the same request two more times, and a `403` is not going
 * to become a `200` because we asked again.
 */
export const adminFilesQueryOptions = ({
  fetchPage = fetchAdminFilesPageInBrowser,
  params,
}: {
  fetchPage?: AdminFilesPageFetcher;
  params: AdminFilesParams;
}) =>
  queryOptions({
    queryFn: async () => await fetchPage(params),
    queryKey: adminFilesQueryKey(params),
    retry: false,
    /** {@link RECORD_STALE_TIME} - Uploads and deletions are things people do; a local one already invalidates this family. */
    staleTime: RECORD_STALE_TIME,
  });
