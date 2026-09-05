import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";
import type { DeleteFileResult } from "@/lib/files/in-use";
import type {
  DeleteAdminFile,
  DeleteAdminFileArgs,
  DeleteAdminFiles,
  DeleteAdminFilesArgs,
} from "@/views/admin/views/core/system/files/files-delete";
import type {
  AdminFilesPageFetcher,
  AdminFilesParams,
} from "@/views/admin/views/core/system/files/files-query";

import { shouldRefreshAfterBulkDelete } from "@/lib/files/bulk-delete";
import { fetcher } from "@/tanstack/fetcher";
import {
  deleteAdminFileInBrowser,
  deleteAdminFilesInBrowser,
} from "@/views/admin/views/core/system/files/files-delete";
import {
  adminFilesPageFetcher,
  adminFilesQueryOptions,
  adminFilesQueryRoot,
} from "@/views/admin/views/core/system/files/files-query";

const fetchAdminFilesPage: AdminFilesPageFetcher =
  adminFilesPageFetcher(fetcher);

export const adminFilesQuery = ({ params }: { params: AdminFilesParams }) =>
  adminFilesQueryOptions({ fetchPage: fetchAdminFilesPage, params });

export const invalidateAdminFiles = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: adminFilesQueryRoot });

export const deleteAdminFile = async (
  queryClient: QueryClient,
  args: DeleteAdminFileArgs,
): Promise<DeleteFileResult> => {
  const result = await deleteAdminFileInBrowser(args);

  if (!result.error) await invalidateAdminFiles(queryClient);

  return result;
};

export const deleteAdminFiles = async (
  queryClient: QueryClient,
  args: DeleteAdminFilesArgs,
): Promise<BulkDeleteFilesResult> => {
  const result = await deleteAdminFilesInBrowser(args);

  if (shouldRefreshAfterBulkDelete(result)) {
    await invalidateAdminFiles(queryClient);
  }

  return result;
};

export const useAdminFilesDeleteCallbacks = (): {
  onDeleteFile: DeleteAdminFile;
  onDeleteFiles: DeleteAdminFiles;
} => {
  const queryClient = useQueryClient();

  return React.useMemo(
    () => ({
      onDeleteFile: async (args: DeleteAdminFileArgs) =>
        await deleteAdminFile(queryClient, args),
      onDeleteFiles: async (args: DeleteAdminFilesArgs) =>
        await deleteAdminFiles(queryClient, args),
    }),
    [queryClient],
  );
};
