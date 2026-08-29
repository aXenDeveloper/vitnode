import { PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import React from "react";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { AdminPermissionRequired } from "@/components/staff-permission/required";
import { DataTableSkeleton } from "@/components/table/data-table";
import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { Link } from "@/lib/navigation";
import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";

import { STAFF_TYPE_SEGMENT, staffCreateHref } from "../staff-model";
import { StaffTableAdmin } from "../table/staff-table";

/**
 * One staff list screen, as this application's Server Component.
 *
 * The administrators and moderators pages were two files that differed in three
 * strings and one word; they are now one, parameterised by the staff type - the
 * same shape `AdminStaffRouteContent` has in the TanStack AdminCP, and for the
 * same reason.
 *
 * The permission tuples come from `adminStaffPermissions`, so the gate here and
 * the loader there check the same names.
 */
export const StaffListAdminView = async ({
  searchParams,
  type,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  type: PermissionStaffType;
}) => {
  const t = await getTranslations(
    `admin.staff.${STAFF_TYPE_SEGMENT[type]}` as "admin.staff.admins",
  );
  const permissions = adminStaffPermissions(type);

  return (
    <div className="p-4">
      <HeaderContent desc={t("desc")} h1={t("title")}>
        <AdminStaffPermissionGate {...permissions.create}>
          <Button
            nativeButton={false}
            render={<Link href={staffCreateHref(type)} />}
          >
            <PlusIcon />
            {t("create")}
          </Button>
        </AdminStaffPermissionGate>
      </HeaderContent>

      <React.Suspense fallback={<DataTableSkeleton columns={5} />}>
        <AdminPermissionRequired {...permissions.view}>
          <StaffTableAdmin searchParams={searchParams} type={type} />
        </AdminPermissionRequired>
      </React.Suspense>
    </div>
  );
};
