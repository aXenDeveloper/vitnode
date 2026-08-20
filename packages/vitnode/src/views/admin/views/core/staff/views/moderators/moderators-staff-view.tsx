import { PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import React from "react";

import { DataTableSkeleton } from "@/components/table/data-table";
import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { notFound } from "@/framework/navigation";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { Link } from "@/lib/navigation";

import { StaffTableAdmin } from "../../table/staff-table";

export const ModeratorsStaffAdminView = async (
  props: Pick<React.ComponentProps<typeof StaffTableAdmin>, "searchParams">,
) => {
  const [t, canView, canCreate] = await Promise.all([
    getTranslations("admin.staff.moderators"),
    checkAdminPermissionApi({
      module: "staff_moderators",
      permission: "can_view",
    }),
    checkAdminPermissionApi({
      module: "staff_moderators",
      permission: "can_create",
    }),
  ]);

  if (!canView) {
    notFound();
  }

  return (
    <div className="p-4">
      <HeaderContent desc={t("desc")} h1={t("title")}>
        {canCreate && (
          <Button
            nativeButton={false}
            render={<Link href="/admin/core/staff/moderators/create" />}
          >
            <PlusIcon />
            {t("create")}
          </Button>
        )}
      </HeaderContent>
      <React.Suspense fallback={<DataTableSkeleton columns={5} />}>
        <StaffTableAdmin type="moderators" {...props} />
      </React.Suspense>
    </div>
  );
};
