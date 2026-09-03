import { createTranslator } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminRolesParams } from "@/views/admin/views/core/users/roles/roles-query";

import { ADMIN_ROLE_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
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
  locale,
  params,
  queryClient,
}: AdminScreenContext & {
  params: AdminRolesParams;
}): Promise<AdminRolesRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_ROLE_PERMISSIONS.view);

  const adminUserId = adminIdentityOf(adminAccess);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_ROLES_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...adminRolesQuery({ adminUserId, params }),
      revalidateIfStale: true,
    }),
  ]);

  const messages = intl.messages as {
    admin: {
      global: { nav: { users: { roles: string } } };
      role: { list: { desc: string } };
    };
  };

  return {
    adminUserId,
    description: createTranslator({
      locale,
      messages,
      namespace: "admin.role.list",
    })("desc"),
    params,
    title: createTranslator({
      locale,
      messages,
      namespace: "admin.global.nav.users",
    })("roles"),
  };
};
