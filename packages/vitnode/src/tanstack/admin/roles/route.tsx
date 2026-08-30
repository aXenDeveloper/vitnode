import { createTranslator } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminRolesParams } from "@/views/admin/views/core/users/roles/roles-query";

import { ADMIN_ROLE_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminRolesQuery } from "./query";

/**
 * `/admin/core/users/roles` - the AdminCP roles list.
 *
 * ## The permission model is the Next.js page's, unchanged
 *
 *     roles.can_view          the list itself
 *     roles.can_create        the create button
 *     roles.can_edit          the edit dialog
 *     roles.can_edit_admin    ...additionally, for a role that grants admin
 *     roles.can_delete        the delete dialog
 *     roles.can_delete_admin  ...additionally, for a role that grants admin
 *
 * `roles.can_view` is a *frontend* gate and only that: `listRolesAdminRoute`
 * declares no `adminStaffPermission` of its own, deliberately, because a role
 * *picker* has to work for an administrator who cannot open the roles *screen*.
 * The writes are all gated on the API - `create`, `update` and `delete` each
 * declare their tuple - so what is checked here decides which page is reachable,
 * not what may be changed.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.role` is the heading, the columns and both dialogs; `admin.global`
 * carries `nav.users.roles`, which is the `<h1>` and the `<title>`; `core.global`
 * is the table's own furniture and the error toasts, listed because
 * `RouteMessages` replaces the root's provider rather than adding to it.
 */
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
    queryClient.ensureQueryData(adminRolesQuery({ adminUserId, params })),
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
