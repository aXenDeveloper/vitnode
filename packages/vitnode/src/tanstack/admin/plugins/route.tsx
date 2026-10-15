import type { PluginRouteTranslator } from "@/routing";

import { installedPluginsQueryOptions } from "@/views/admin/views/core/system/plugins/plugins-query";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";

export const ADMIN_PLUGINS_NAMESPACES = [
  "admin.system.plugins",
  "core.global",
] as const;

export interface AdminPluginsRouteData {
  description: string;
  title: string;
}

const PLUGINS_VIEW_PERMISSION = {
  module: "plugins",
  permission: "can_view",
} as const;

export const loadAdminPluginsRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminPluginsRouteData> => {
  requireAdminPermission(adminAccess, PLUGINS_VIEW_PERMISSION);

  await queryClient.query({
    ...installedPluginsQueryOptions(),
    staleTime: "static",
  });

  return {
    description: t("admin.system.plugins.desc"),
    title: t("admin.system.plugins.title"),
  };
};
