import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";
import type { DeleteFileResult } from "@/lib/files/in-use";

import { fetcherClient } from "@/lib/fetcher-client";
import {
  runBulkFileDelete,
  shouldRefreshAfterBulkDelete,
} from "@/lib/files/bulk-delete";
import { readFileInUse } from "@/lib/files/in-use";
import { FILES_PREFIX_PATH } from "@/views/files/my-files-query";

import { userFilesModuleRef } from "./my-files-query";

export interface DeleteMyFileArgs {
  force?: boolean;
  id: number;
}

export interface DeleteMyFilesArgs {
  force?: boolean;
  ids: number[];
}

export type DeleteMyFile = (
  args: DeleteMyFileArgs,
) => Promise<DeleteFileResult>;

export type DeleteMyFiles = (
  args: DeleteMyFilesArgs,
) => Promise<BulkDeleteFilesResult>;

export const deleteMyFileInBrowser: DeleteMyFile = async ({
  force = false,
  id,
}) => {
  try {
    const response = await fetcherClient(userFilesModuleRef, {
      args: {
        params: { id: String(id) },
        query: force ? { force: "true" } : {},
      },
      method: "delete",
      module: "files",
      options: { credentials: "include" },
      path: "/{id}",
      prefixPath: FILES_PREFIX_PATH,
    });

    if (response.status !== 200) {
      return {
        error: {
          inUse: await readFileInUse(response),
          status: response.status,
        },
      };
    }

    return { data: true };
  } catch {
    return { error: { status: 500 } };
  }
};

export const deleteMyFilesInBrowser: DeleteMyFiles = async ({
  force = false,
  ids,
}) =>
  await runBulkFileDelete(
    ids,
    async id => await deleteMyFileInBrowser({ force, id }),
  );

export { shouldRefreshAfterBulkDelete };

export type { BulkDeleteFilesResult, DeleteFileResult };
