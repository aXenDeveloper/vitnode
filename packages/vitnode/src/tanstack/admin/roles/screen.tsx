import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";

import {
  AdminStaffPermissionGate,
  useAdminStaffPermission,
} from "@/components/staff-permission/provider";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { PageTitle } from "@/components/ui/page-title";
import { ADMIN_AI_PERMISSIONS } from "@/views/admin/views/core/ai/ai-permissions";
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
import { adminAiRoleAccessQuery } from "../ai/query";
import { useAdminRoleMutations } from "./query";
import { adminRolesQuery } from "./query";
import { ADMIN_ROLES_NAMESPACES } from "./route";
import { rolesSearchFrom, rolesSearchParams } from "./route-search";

export interface AdminRolesRouteProps extends AdminRolesRouteData {
  navigate: AdminTableNavigate<RolesRouteSearch>;
  search: UncheckedRolesSearch;
}

export const AdminRolesRouteContent = ({
  adminUserId,
  description,
  navigate,
  params,
  search,
  title,
}: AdminRolesRouteProps) => {
  const { data } = useSuspenseQuery(adminRolesQuery({ adminUserId, params }));
  const { onDelete, onSave, onSaved } = useAdminRoleMutations();
  const canManageAi = useAdminStaffPermission(ADMIN_AI_PERMISSIONS.manage);
  const aiAccessQuery = React.useMemo(
    () =>
      canManageAi
        ? (roleId: null | number) =>
            adminAiRoleAccessQuery({ adminUserId, roleId })
        : undefined,
    [adminUserId, canManageAi],
  );

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
      <div className="p-6">
        <PageTitle desc={description} h1={title}>
          <AdminStaffPermissionGate {...ADMIN_ROLE_PERMISSIONS.create}>
            <CreateRoleAction
              aiAccessQuery={aiAccessQuery}
              onSave={onSave}
              onSaved={onSaved}
            />
          </AdminStaffPermissionGate>
        </PageTitle>

        <DataTableNavigationProvider value={navigation}>
          <RolesAdminTableContent
            aiAccessQuery={aiAccessQuery}
            data={data}
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
