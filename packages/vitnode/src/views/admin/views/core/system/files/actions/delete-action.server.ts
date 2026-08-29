"use server";

import { revalidatePath } from "next/cache";

import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";
import type { DeleteFileResult } from "@/lib/files/in-use";

import { filesAdminModule } from "@/api/modules/admin/files/files.admin.module";
import { fetcher } from "@/lib/fetcher";
import {
  runBulkFileDelete,
  shouldRefreshAfterBulkDelete,
} from "@/lib/files/bulk-delete";
import { readFileInUse } from "@/lib/files/in-use";

import { deleteAdminFileRequest } from "../files-delete";

/**
 * The Next.js half of deleting an uploaded file: the same request, ending in
 * `revalidatePath`.
 *
 * The request itself is `deleteAdminFileRequest`'s - the same builder the
 * browser mutation uses - so the two frameworks send an identical `DELETE`, with
 * an identical `force`, and read an identical `409` body. Only the last line
 * differs, which is the whole reason the two exist separately.
 */

/** The delete itself, without the revalidate a bulk run only wants once. */
const deleteFile = async ({
  force,
  id,
}: {
  force: boolean;
  id: number;
}): Promise<DeleteFileResult> => {
  const res = await fetcher(
    filesAdminModule,
    deleteAdminFileRequest({ force, id }),
  );

  if (res.status !== 200) {
    return { error: { inUse: await readFileInUse(res), status: res.status } };
  }

  return { data: true };
};

export const deleteFileAction = async ({
  force = false,
  id,
}: {
  force?: boolean;
  id: number;
}): Promise<DeleteFileResult> => {
  const result = await deleteFile({ force, id });

  if (result.error) {
    return result;
  }

  revalidatePath("/[locale]/admin", "layout");

  return result;
};

export const deleteFilesAction = async ({
  force = false,
  ids,
}: {
  force?: boolean;
  ids: number[];
}): Promise<BulkDeleteFilesResult> => {
  const result = await runBulkFileDelete(ids, async id =>
    deleteFile({ force, id }),
  );

  // Only when something actually went - the shared rule, so the TanStack Start
  // app's invalidation and this revalidate cannot drift apart. A run that was
  // refused outright leaves the page exactly as it was, and refreshing would
  // drop the selection that is showing which rows were kept.
  if (shouldRefreshAfterBulkDelete(result)) {
    revalidatePath("/[locale]/admin", "layout");
  }

  return result;
};
