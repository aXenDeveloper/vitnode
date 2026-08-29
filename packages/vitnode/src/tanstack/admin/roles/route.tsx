"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AdminRolesParams } from "@/views/admin/views/core/users/roles/roles-query";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { ADMIN_ROLE_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";
import {
  CreateRoleAction,
  RolesAdminTableContent,
} from "@/views/admin/views/core/users/roles/roles-table-content";

import type { AdminScreenContext } from "../screen";
import type { AdminTableNavigate } from "../table-search";
import type { RolesRouteSearch, UncheckedRolesSearch } from "./route-search";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminRolesQuery, useAdminRoleMutations } from "./query";
import { rolesSearchFrom, rolesSearchParams } from "./route-search";

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

export interface AdminRolesRouteProps extends AdminRolesRouteData {
  LinkComponent: AuthLinkComponent;
  navigate: AdminTableNavigate<RolesRouteSearch>;
  search: UncheckedRolesSearch;
}

export const AdminRolesRouteContent = ({
  adminUserId,
  description,
  LinkComponent,
  navigate,
  params,
  search,
  title,
}: AdminRolesRouteProps) => {
  const { data } = useSuspenseQuery(adminRolesQuery({ adminUserId, params }));
  const { onDelete, onSave, onSaved } = useAdminRoleMutations();

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: rolesSearchFrom(nextSearch),
        });
      },
      searchParams: rolesSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={ADMIN_ROLES_NAMESPACES}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title}>
          <AdminStaffPermissionGate {...ADMIN_ROLE_PERMISSIONS.create}>
            <CreateRoleAction onSave={onSave} onSaved={onSaved} />
          </AdminStaffPermissionGate>
        </HeaderContent>

        <DataTableNavigationProvider value={navigation}>
          <RolesAdminTableContent
            data={data}
            LinkComponent={LinkComponent}
            onDelete={onDelete}
            onSave={onSave}
            onSaved={onSaved}
            searchRoles={searchAdminRolesInBrowser}
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
