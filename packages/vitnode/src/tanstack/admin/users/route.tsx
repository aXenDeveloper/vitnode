import { createTranslator } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminUsersParams } from "@/views/admin/views/core/users/list/users-query";

import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
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
  locale,
  params,
  queryClient,
}: AdminScreenContext & {
  params: AdminUsersParams;
}): Promise<AdminUsersRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_USER_PERMISSIONS.view);

  const adminUserId = adminIdentityOf(adminAccess);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_USERS_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...adminUsersQuery({ adminUserId, params }),
      revalidateIfStale: true,
    }),
  ]);

  const messages = intl.messages as {
    admin: {
      global: { nav: { users: { list: string } } };
      user: { list: { desc: string } };
    };
  };
  const t = createTranslator({
    locale,
    messages,
    namespace: "admin.user.list",
  });
  const tNav = createTranslator({
    locale,
    messages,
    namespace: "admin.global.nav.users",
  });

  return {
    adminUserId,
    description: t("desc"),
    params,
    title: tNav("list"),
  };
};
