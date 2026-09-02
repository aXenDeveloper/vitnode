import "@tanstack/react-start/server-only";

import type { AdminFilesParams } from "@/views/admin/views/core/system/files/files-query";

import { filesAdminModule } from "@/api/modules/admin/files/files.admin.module";
import {
  AdminRequestError,
  describeAdminParams,
} from "@/views/admin/admin-request";
import { ADMIN_FILES_PREFIX_PATH } from "@/views/admin/views/core/system/files/files-query";

import { fetcher } from "../../fetcher/server";

export const fetchAdminFilesPageOnServer = async (params: AdminFilesParams) => {
  const response = await fetcher(filesAdminModule, {
    args: { query: params },
    method: "get",
    module: "files",
    path: "/",
    prefixPath: ADMIN_FILES_PREFIX_PATH,
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
