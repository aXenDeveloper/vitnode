import { queryOptions } from "@tanstack/react-query";

import type {
  AdminTableContract,
  AdminTablePage,
  AdminTableParams,
} from "@/views/admin/table/params";

import { CONFIG_PLUGIN } from "@/config";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

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
  /** ISO string over the wire; a `Date` when a server render passes it in. */
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

/** One page, over whichever transport the host hands in. */
export const fetchAdminFilesPage: AdminFilesPageFetcher = async params => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { query: params },
    method: "get",
    module: "admin/files",
    path: "/",
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

export const adminFilesQueryKey = (params: AdminFilesParams) =>
  [...adminFilesQueryRoot, params] as const;

export const adminFilesQueryOptions = ({
  fetchPage = fetchAdminFilesPage,
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
