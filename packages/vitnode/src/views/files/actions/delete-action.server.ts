"use server";

import { revalidatePath } from "next/cache";

import type { BulkDeleteFilesResult } from "@/lib/files/bulk-delete";
import type { DeleteFileResult } from "@/lib/files/in-use";

import { userFilesModule } from "@/api/modules/users/files/files.module";
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
  const res = await fetcher(userFilesModule, {
    path: "/{id}",
    method: "delete",
    module: "files",
    prefixPath: "/users",
    args: {
      params: { id: String(id) },
      query: force ? { force: "true" } : {},
    },
  });

  if (res.status !== 200) {
    return { error: { inUse: await readFileInUse(res), status: res.status } };
  }

  return { data: true };
};

export const deleteMyFileAction = async ({
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

  revalidatePath("/[locale]/(main)", "layout");

  return result;
};

export const deleteMyFilesAction = async ({
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
    revalidatePath("/[locale]/(main)", "layout");
  }

  return result;
};
