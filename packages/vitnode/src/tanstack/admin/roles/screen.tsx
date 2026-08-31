"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";
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

import type { AdminTableNavigate } from "../table-search";
import type { AdminRolesRouteData } from "./route";
import type { RolesRouteSearch, UncheckedRolesSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminRoleMutations } from "./query";
import { adminRolesQuery } from "./query";
import { ADMIN_ROLES_NAMESPACES } from "./route";
import { rolesSearchFrom, rolesSearchParams } from "./route-search";

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
