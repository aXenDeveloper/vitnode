import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";
import type { DeleteFileResult } from "@/lib/files/in-use";

import { fetcherClient } from "@/lib/fetcher-client";
import { runBulkFileDelete } from "@/lib/files/bulk-delete";
import { readFileInUse } from "@/lib/files/in-use";
import { ADMIN_FILES_PREFIX_PATH } from "@/views/admin/views/core/system/files/files-query";

import { filesAdminModuleRef } from "./files-query";

/** Deleting one file. `force` releases retained revisions; see `FileInUse`. */
export interface DeleteAdminFileArgs {
  force?: boolean;
  id: number;
}

/** Deleting a selection. The ids are exactly the rows that were ticked. */
export interface DeleteAdminFilesArgs {
  force?: boolean;
  ids: number[];
}

export type DeleteAdminFile = (
  args: DeleteAdminFileArgs,
) => Promise<DeleteFileResult>;

export type DeleteAdminFiles = (
  args: DeleteAdminFilesArgs,
) => Promise<BulkDeleteFilesResult>;

export const deleteAdminFileInBrowser: DeleteAdminFile = async ({
  force = false,
  id,
}) => {
  try {
    const response = await fetcherClient(filesAdminModuleRef, {
      args: {
        params: { id: String(id) },
        query: force ? { force: "true" } : {},
      },
      method: "delete",
      module: "files",
      options: { credentials: "include" },
      path: "/{id}",
      prefixPath: ADMIN_FILES_PREFIX_PATH,
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

export const deleteAdminFilesInBrowser: DeleteAdminFiles = async ({
  force = false,
  ids,
}) =>
  await runBulkFileDelete(
    ids,
    async id => await deleteAdminFileInBrowser({ force, id }),
  );

export type { BulkDeleteFilesResult, DeleteFileResult };
