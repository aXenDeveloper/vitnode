import type { PluginRouteTranslator } from "@/routing";

import { adminSiteStatusQueryOptions } from "@/views/admin/views/core/system/site-status/site-status-query";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";

/**
 * `/admin/core/system/site-status`, as everything a TanStack Start route
 * needs and nothing a route owns.
 */

export const ADMIN_SITE_STATUS_NAMESPACES = [
  "admin.system.site_status",
  "core.site_offline",
  "core.global",
] as const;

/** What {@link loadAdminSiteStatusRoute} returns - and what `head` receives. */
export interface AdminSiteStatusRouteData {
  description: string;
  title: string;
}

export const SITE_STATUS_MODULE = "site_status";

export const loadAdminSiteStatusRoute = async ({
  adminAccess,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminSiteStatusRouteData> => {
  requireAdminPermission(adminAccess, {
    module: SITE_STATUS_MODULE,
    permission: "can_view",
  });

  // A failed first load is shown by the screen, with a retry.
  await queryClient
    .query({ ...adminSiteStatusQueryOptions(), staleTime: "static" })
    .catch(() => undefined);

  return {
    description: t("admin.system.site_status.desc"),
    title: t("admin.system.site_status.title"),
  };
};
