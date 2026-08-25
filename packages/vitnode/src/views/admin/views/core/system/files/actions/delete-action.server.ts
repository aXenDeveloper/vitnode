"use server";

import { revalidatePath } from "next/cache";

import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";
import type { DeleteFileResult } from "@/lib/files/in-use";

import { filesAdminModule } from "@/api/modules/admin/files/files.admin.module";
import { fetcher } from "@/lib/fetcher";
import { runBulkFileDelete } from "@/lib/files/bulk-delete";
import { readFileInUse } from "@/lib/files/in-use";

/** The delete itself, without the revalidate a bulk run only wants once. */
const deleteFile = async ({
  force,
  id,
}: {
  force: boolean;
  id: number;
}): Promise<DeleteFileResult> => {
  const res = await fetcher(filesAdminModule, {
    path: "/{id}",
    method: "delete",
    module: "files",
    prefixPath: "/admin",
    args: {
      params: { id: String(id) },
      // Only ever sent for the second attempt, after the first one has told the
      // person what forcing it costs.
      query: force ? { force: "true" } : {},
    },
  });

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

  // Only when something actually went: a run that was refused outright leaves
  // the page exactly as it was, and revalidating would drop the selection that
  // is showing which rows were kept.
  if (result.deleted > 0) {
    revalidatePath("/[locale]/admin", "layout");
  }

  return result;
};
