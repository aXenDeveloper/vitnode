import type { PluginRouteTranslator } from "@/routing";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { navigationNamespaces } from "@/lib/navigation";
import { ADMIN_NAVIGATION_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminNavigationPresetsQuery, adminNavigationQuery } from "./query";

export const ADMIN_NAVIGATION_NAMESPACES = [
  "admin.global",
  "admin.navigation",
  "core.global",
] as const;

export interface AdminNavigationRouteData {
  adminUserId: AdminIdentity;
  description: string;
  namespaces: string[];
  title: string;
}

export const loadAdminNavigationRoute = async ({
  adminAccess,
  locale,
  queryClient,
  t,
}: AdminScreenContext & {
  t: PluginRouteTranslator;
}): Promise<AdminNavigationRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_NAVIGATION_PERMISSIONS.view);

  const adminUserId = adminIdentityOf(adminAccess);

  const [, { presets }] = await Promise.all([
    queryClient.query({
      ...adminNavigationQuery({ adminUserId }),
      staleTime: "static",
    }),
    queryClient.query({
      ...adminNavigationPresetsQuery({ adminUserId }),
      staleTime: "static",
    }),
  ]);

  const namespaces = navigationNamespaces(
    presets.map(preset => ({
      kind: "preset" as const,
      pluginId: preset.pluginId,
    })),
  );

  await queryClient.query({
    ...intlQueryOptions({
      locale,
      namespaces: [...ADMIN_NAVIGATION_NAMESPACES, ...namespaces],
    }),
    staleTime: "static",
  });

  return {
    adminUserId,
    description: t("admin.navigation.list.desc"),
    namespaces,
    title: t("admin.global.nav.system.navigation"),
  };
};
