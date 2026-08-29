import { notFound } from "next/navigation";

import type { RawAdminTableParams } from "@/views/admin/table/params";

import { filesAdminModule } from "@/api/modules/admin/files/files.admin.module";
import { NextDataTableNavigation } from "@/components/table/navigation-next";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { fetcher } from "@/lib/fetcher";
import { normalizeAdminTableParams } from "@/views/admin/table/params";

import {
  deleteFileAction,
  deleteFilesAction,
} from "./actions/delete-action.server";
import { ADMIN_FILES_TABLE_CONTRACT, adminFilesRequest } from "./files-query";
import { FilesTableContent } from "./files-table-content";

/**
 * The Next.js half of `/admin/core/system/files`: read the page and the two
 * permissions, then hand them to the shared table.
 *
 * Everything Next.js about the screen is here. It is a Server Component, so it
 * fetches with `fetcher()` and resolves permissions with
 * `checkAdminPermissionApi` - both of which read the admin cookie through
 * `next/headers` - and answers a refusal with `notFound()`. The two deletes are
 * the server actions, unchanged: they end in `revalidatePath`.
 *
 * The request is not Next.js's: `normalizeAdminTableParams` and
 * `adminFilesRequest` are the same two functions the TanStack Start loader
 * calls.
 */
export const FilesTableView = async ({
  searchParams,
}: {
  searchParams: Promise<RawAdminTableParams>;
}) => {
  const params = normalizeAdminTableParams(
    await searchParams,
    ADMIN_FILES_TABLE_CONTRACT,
  );
  const [canDownload, canDelete, res] = await Promise.all([
    checkAdminPermissionApi({ module: "files", permission: "can_download" }),
    checkAdminPermissionApi({ module: "files", permission: "can_delete" }),
    fetcher(filesAdminModule, adminFilesRequest(params)),
  ]);

  if (res.status !== 200) {
    return notFound();
  }

  const data = await res.json();

  return (
    <NextDataTableNavigation>
      <FilesTableContent
        canDelete={canDelete}
        canDownload={canDownload}
        data={data}
        onDeleteFile={deleteFileAction}
        onDeleteFiles={deleteFilesAction}
      />
    </NextDataTableNavigation>
  );
};
