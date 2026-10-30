import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HistoryIcon, PlusIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { manifest } from "@/manifest";
import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";
import {
  staffCreateHref,
  staffLogsHref,
} from "@/views/admin/views/core/staff/staff-model";
import { StaffTableContent } from "@/views/admin/views/core/staff/table/staff-table-content";

import type { AdminTableNavigate } from "../table-search";
import type { AdminStaffRouteData } from "./route";
import type { StaffRouteSearch, UncheckedStaffSearch } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";
import { ACTIVITY_LOGS_MODULE } from "./logs-route";
import { adminStaffQuery, useStaffDeleteCallback } from "./query";
import { ADMIN_STAFF_NAMESPACES } from "./route";
import { staffSearchFrom, staffSearchParams } from "./route-search";

export interface AdminStaffRouteProps extends AdminStaffRouteData {
  navigate: AdminTableNavigate<StaffRouteSearch>;
  search: UncheckedStaffSearch;
}

const LogsLink = ({ type }: { type: AdminStaffRouteData["type"] }) => {
  const t = useTranslations("admin.staff.logs");

  return (
    <AdminStaffPermissionGate
      module={ACTIVITY_LOGS_MODULE}
      permission="can_view"
      plugin={manifest.id}
    >
      <Link
        className={buttonVariants({ variant: "outline" })}
        to={staffLogsHref(type)}
      >
        <HistoryIcon aria-hidden />
        {t("open")}
      </Link>
    </AdminStaffPermissionGate>
  );
};

export const AdminStaffRouteContent = ({
  adminUserId,
  createLabel,
  description,
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
      <div className="p-6">
        <PageTitle desc={description} h1={title}>
          <LogsLink type={type} />
          <AdminStaffPermissionGate {...adminStaffPermissions(type).create}>
            <Link className={buttonVariants()} to={staffCreateHref(type)}>
              <PlusIcon />
              {createLabel}
            </Link>
          </AdminStaffPermissionGate>
        </PageTitle>

        <DataTableNavigationProvider value={navigation}>
          <StaffTableContent data={data} onDelete={onDelete} type={type} />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
