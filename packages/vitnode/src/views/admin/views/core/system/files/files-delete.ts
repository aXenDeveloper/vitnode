import type { DeleteFileResult } from "@vitnode/api/lib/files/in-use";

import { readFileInUse } from "@vitnode/api/lib/files/in-use";
import { manifest } from "@vitnode/api/manifest";

import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";

import { fetcherClient } from "@/lib/fetcher-client";
import { runBulkFileDelete } from "@/lib/files/bulk-delete";

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
    const response = await fetcherClient({
      plugin: manifest.id,
      args: {
        params: { id: String(id) },
        query: force ? { force: "true" } : {},
      },
      method: "delete",
      module: "admin/files",
      options: { credentials: "include" },
      path: "/{id}",
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
