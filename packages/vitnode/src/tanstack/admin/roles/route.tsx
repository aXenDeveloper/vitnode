import type { PluginRouteTranslator } from "@/routing";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminRolesParams } from "@/views/admin/views/core/users/roles/roles-query";

import { ADMIN_ROLE_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminScreenContext } from "../screen";

import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminRolesQuery } from "./query";

export const ADMIN_ROLES_NAMESPACES = [
  "admin.global",
  "admin.role",
  "core.global",
] as const;

export interface AdminRolesRouteData {
  adminUserId: AdminIdentity;
  description: string;
  params: AdminRolesParams;
  title: string;
}

export const loadAdminRolesRoute = async ({
  adminAccess,
  params,
  queryClient,
  t,
}: AdminScreenContext & {
  params: AdminRolesParams;
  t: PluginRouteTranslator;
}): Promise<AdminRolesRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_ROLE_PERMISSIONS.view);

  const adminUserId = adminIdentityOf(adminAccess);

  await queryClient.query({
    ...adminRolesQuery({ adminUserId, params }),
    staleTime: "static",
  });

  return {
    adminUserId,
    description: t("admin.role.list.desc"),
    params,
    title: t("admin.global.nav.users.roles"),
  };
};
