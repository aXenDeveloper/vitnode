import type { PluginRouteTranslator } from "@/routing";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminUsersParams } from "@/views/admin/views/core/users/list/users-query";

import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminScreenContext } from "../screen";

import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminUsersQuery } from "./query";

export const ADMIN_USERS_NAMESPACES = [
  "admin.global",
  "admin.user",
  "core.global",
] as const;

/** What {@link loadAdminUsersRoute} returns, and therefore what `head` receives. */
export interface AdminUsersRouteData {
  adminUserId: AdminIdentity;
  description: string;
  params: AdminUsersParams;
  title: string;
}

export const loadAdminUsersRoute = async ({
  adminAccess,
  params,
  queryClient,
  t,
}: AdminScreenContext & {
  params: AdminUsersParams;
  t: PluginRouteTranslator;
}): Promise<AdminUsersRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_USER_PERMISSIONS.view);

  const adminUserId = adminIdentityOf(adminAccess);

  await queryClient.query({
    ...adminUsersQuery({ adminUserId, params }),
    staleTime: "static",
  });

  return {
    adminUserId,
    description: t("admin.user.list.desc"),
    params,
    title: t("admin.global.nav.users.list"),
  };
};
