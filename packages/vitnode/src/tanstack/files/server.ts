import "@tanstack/react-start/server-only";

import type { MyFilesParams } from "@/views/files/my-files-query";

import { userFilesModule } from "@/api/modules/users/files/files.module";
import {
  FILES_PREFIX_PATH,
  MyFilesRequestError,
} from "@/views/files/my-files-query";

import { fetcher } from "../fetcher/server";

export const fetchMyFilesPageOnServer = async (params: MyFilesParams) => {
  const response = await fetcher(userFilesModule, {
    args: { query: params },
    method: "get",
    module: "files",
    path: "/",
    prefixPath: FILES_PREFIX_PATH,
  });

  if (!response.ok) throw new MyFilesRequestError(response.status, params);

  return await response.json();
};
