import type { PluginRouteTranslator } from "@/routing";

import { ADMIN_SEO_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { adminSeoQueryOptions } from "@/views/admin/views/core/system/seo/seo-query";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";

/** `/admin/core/system/seo`: `robots.txt` and the XML sitemaps. */
export const ADMIN_SEO_NAMESPACES = [
  "admin.system.seo",
  "core.global",
] as const;

/** What {@link loadAdminSeoRoute} returns - and what `head` receives. */
export interface AdminSeoRouteData {
  description: string;
  title: string;
}

export const loadAdminSeoRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminSeoRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_SEO_PERMISSIONS.view);

  await queryClient.query({ ...adminSeoQueryOptions(), staleTime: "static" });

  return {
    description: t("admin.system.seo.desc"),
    title: t("admin.system.seo.title"),
  };
};
