"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import React from "react";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { buttonVariants } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";
import { staffCreateHref } from "@/views/admin/views/core/staff/staff-model";
import { StaffTableContent } from "@/views/admin/views/core/staff/table/staff-table-content";

import type { AdminTableNavigate } from "../table-search";
import type { AdminStaffRouteData } from "./route";
import type { StaffRouteSearch, UncheckedStaffSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { adminStaffQuery, useStaffDeleteCallback } from "./query";
import { ADMIN_STAFF_NAMESPACES } from "./route";
import { staffSearchFrom, staffSearchParams } from "./route-search";

export interface AdminStaffRouteProps extends AdminStaffRouteData {
  LinkComponent: AuthLinkComponent;
  navigate: AdminTableNavigate<StaffRouteSearch>;
  search: UncheckedStaffSearch;
}

export const AdminStaffRouteContent = ({
  adminUserId,
  createLabel,
  description,
  LinkComponent,
  navigate,
  params,
  search,
  title,
  type,
}: AdminStaffRouteProps) => {
  const { data } = useSuspenseQuery(
    adminStaffQuery({ adminUserId, params, type }),
  );
  const onDelete = useStaffDeleteCallback();

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: staffSearchFrom(nextSearch),
        });
      },
      searchParams: staffSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={ADMIN_STAFF_NAMESPACES}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title}>
          <AdminStaffPermissionGate {...adminStaffPermissions(type).create}>
            <LinkComponent
              className={buttonVariants()}
              href={staffCreateHref(type)}
            >
              <PlusIcon />
              {createLabel}
            </LinkComponent>
          </AdminStaffPermissionGate>
        </HeaderContent>

        <DataTableNavigationProvider value={navigation}>
          <StaffTableContent
            data={data}
            LinkComponent={LinkComponent}
            onDelete={onDelete}
            type={type}
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
