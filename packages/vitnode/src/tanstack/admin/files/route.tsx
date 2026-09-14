import type { PluginRouteTranslator } from "@/routing";
import type { AdminFilesParams } from "@/views/admin/views/core/system/files/files-query";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";
import { adminFilesQuery } from "./query";

/**
 * `/admin/core/system/files`, as everything a TanStack Start route needs and
 * nothing a route owns.
 */

export const ADMIN_FILES_NAMESPACES = [
  "admin.system.files",
  "core.global",
] as const;

/** What {@link loadAdminFilesRoute} returns, and therefore what `head` receives. */
export interface AdminFilesRouteData {
  description: string;
  params: AdminFilesParams;
  title: string;
}

/** The core plugin, named once for the three tuples this screen reads. */
export const FILES_MODULE = "files";

/**
 * The tuple `<AdminPermissionRequired module="files" permission="can_view">`
 * states, and the one `listFilesAdminRoute` declares.
 */
const FILES_VIEW_PERMISSION = {
  module: FILES_MODULE,
  permission: "can_view",
} as const;

export const loadAdminFilesRoute = async ({
  adminAccess,
  params,
  queryClient,
  t,
}: AdminScreenContext & {
  params: AdminFilesParams;
  t: PluginRouteTranslator;
}): Promise<AdminFilesRouteData> => {
  requireAdminPermission(adminAccess, FILES_VIEW_PERMISSION);

  await queryClient.query({
    ...adminFilesQuery({ params }),
    staleTime: "static",
  });

  return {
    description: t("admin.system.files.desc"),
    params,
    title: t("admin.system.files.title"),
  };
};
