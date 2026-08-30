"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { CreateUserAdminContent } from "@/views/admin/views/core/users/list/create-user-content";
import { UsersAdminTableContent } from "@/views/admin/views/core/users/list/users-table-content";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";
import { createAdminUser } from "@/views/admin/views/core/users/users-mutations";

import type { AdminTableNavigate } from "../table-search";
import type { AdminUsersRouteData } from "./route";
import type { UncheckedUsersSearch, UsersRouteSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { useAdminIdentity } from "../identity";
import {
  adminUsersQuery,
  invalidateAdminUsers,
  useAdminUserMutations,
} from "./query";
import { ADMIN_USERS_NAMESPACES } from "./route";
import { usersSearchFrom, usersSearchParams } from "./route-search";

export interface AdminUsersRouteProps extends AdminUsersRouteData {
  LinkComponent: AuthLinkComponent;
  navigate: AdminTableNavigate<UsersRouteSearch>;
  search: UncheckedUsersSearch;
}

/**
 * `/admin/core/users`, as everything below a route file's `component`.
 *
 * `navigate`, `search` and `LinkComponent` come from the host: TanStack infers
 * the first two from the `createFileRoute` path, and the third is how *this*
 * application renders an internal link while half of `/admin/*` is still served
 * by Next.js.
 *
 * The heading is outside the table, exactly as in the Next.js page, and rendered
 * from the loader's own strings - so the `<h1>` and the `<title>` are the same
 * string by construction.
 */
export const AdminUsersRouteContent = ({
  adminUserId,
  description,
  LinkComponent,
  navigate,
  params,
  search,
  title,
}: AdminUsersRouteProps) => {
  const { data } = useSuspenseQuery(adminUsersQuery({ adminUserId, params }));
  const { onVerifyEmail } = useAdminUserMutations();
  const queryClient = useQueryClient();
  const identity = useAdminIdentity();

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: usersSearchFrom(nextSearch),
        });
      },
      searchParams: usersSearchParams(search),
    }),
    [navigate, search],
  );

  const onCreate = React.useCallback<
    React.ComponentProps<typeof CreateUserAdminContent>["onCreate"]
  >(
    async input => {
      const result = await createAdminUser(input);
      if ("data" in result) await invalidateAdminUsers(queryClient, identity);

      return result;
    },
    [identity, queryClient],
  );

  return (
    <RouteMessages namespaces={ADMIN_USERS_NAMESPACES}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title}>
          <AdminStaffPermissionGate {...ADMIN_USER_PERMISSIONS.create}>
            <CreateUserAdminContent onCreate={onCreate} />
          </AdminStaffPermissionGate>
        </HeaderContent>

        <DataTableNavigationProvider value={navigation}>
          <UsersAdminTableContent
            data={data}
            LinkComponent={LinkComponent}
            onVerifyEmail={onVerifyEmail}
            searchRoles={searchAdminRolesInBrowser}
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
