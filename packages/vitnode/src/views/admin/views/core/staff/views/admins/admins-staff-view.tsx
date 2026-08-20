import { PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import React from "react";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { AdminPermissionRequired } from "@/components/staff-permission/required";
import { DataTableSkeleton } from "@/components/table/data-table";
import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { CONFIG_PLUGIN } from "@/config";
import { Link } from "@/lib/navigation";

import { StaffTableAdmin } from "../../table/staff-table";

export const AdminsStaffAdminView = async (
  props: Pick<React.ComponentProps<typeof StaffTableAdmin>, "searchParams">,
) => {
  const t = await getTranslations("admin.staff.admins");

  return (
    <div className="p-4">
      <HeaderContent desc={t("desc")} h1={t("title")}>
        <AdminStaffPermissionGate
          module="staff_admins"
          permission="can_create"
          plugin={CONFIG_PLUGIN.pluginId}
        >
          <Button
            nativeButton={false}
            render={<Link href="/admin/core/staff/admins/create" />}
          >
            <PlusIcon />
            {t("create")}
          </Button>
        </AdminStaffPermissionGate>
      </HeaderContent>

      <React.Suspense fallback={<DataTableSkeleton columns={5} />}>
        <AdminPermissionRequired module="staff_admins" permission="can_view">
          <StaffTableAdmin type="admins" {...props} />
        </AdminPermissionRequired>
      </React.Suspense>
    </div>
  );
};
