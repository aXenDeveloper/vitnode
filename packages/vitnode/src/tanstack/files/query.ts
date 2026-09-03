import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type {
  BulkDeleteFilesResult,
  DeleteFileResult,
  DeleteMyFile,
  DeleteMyFileArgs,
  DeleteMyFiles,
  DeleteMyFilesArgs,
} from "@/views/files/my-files-delete";
import type {
  MyFilesPageFetcher,
  MyFilesParams,
} from "@/views/files/my-files-query";

import {
  deleteMyFileInBrowser,
  deleteMyFilesInBrowser,
  shouldRefreshAfterBulkDelete,
} from "@/views/files/my-files-delete";
import {
  fetchMyFilesPageInBrowser,
  myFilesQueryOptions,
  myFilesQueryRoot,
} from "@/views/files/my-files-query";

import { fetchMyFilesPageOnServer } from "./server";

const fetchMyFilesPage: MyFilesPageFetcher = createIsomorphicFn()
  .server(fetchMyFilesPageOnServer)
  .client(fetchMyFilesPageInBrowser);

export const myFilesQuery = ({
  params,
  userId,
}: {
  params: MyFilesParams;
  userId: number;
}) => myFilesQueryOptions({ fetchPage: fetchMyFilesPage, params, userId });

export const invalidateMyFiles = async (
  queryClient: QueryClient,
  userId: number,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: myFilesQueryRoot(userId) });

export const deleteMyFile = async (
  queryClient: QueryClient,
  userId: number,
  args: DeleteMyFileArgs,
): Promise<DeleteFileResult> => {
  const result = await deleteMyFileInBrowser(args);

  if (!result.error) await invalidateMyFiles(queryClient, userId);

  return result;
};

export const deleteMyFiles = async (
  queryClient: QueryClient,
  userId: number,
  args: DeleteMyFilesArgs,
): Promise<BulkDeleteFilesResult> => {
  const result = await deleteMyFilesInBrowser(args);

  if (shouldRefreshAfterBulkDelete(result)) {
    await invalidateMyFiles(queryClient, userId);
  }

  return result;
};

export const useMyFilesDeleteCallbacks = (
  userId: number,
): {
  onDeleteFile: DeleteMyFile;
  onDeleteFiles: DeleteMyFiles;
} => {
  const queryClient = useQueryClient();

  return React.useMemo(
    () => ({
      onDeleteFile: async (args: DeleteMyFileArgs) =>
        await deleteMyFile(queryClient, userId, args),
      onDeleteFiles: async (args: DeleteMyFilesArgs) =>
        await deleteMyFiles(queryClient, userId, args),
    }),
    [queryClient, userId],
  );
};
