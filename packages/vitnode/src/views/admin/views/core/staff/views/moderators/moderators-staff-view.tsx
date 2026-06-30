import { PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import React from "react";

import { DataTableSkeleton } from "@/components/table/data-table";
import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { Link } from "@/lib/navigation";

import { StaffTableAdmin } from "../../table/staff-table";

export const ModeratorsStaffAdminView = async (
  props: Pick<React.ComponentProps<typeof StaffTableAdmin>, "searchParams">,
) => {
  const t = await getTranslations("admin.staff.moderators");

  return (
    <div className="p-4">
      <HeaderContent desc={t("desc")} h1={t("title")}>
        <Button
          nativeButton={false}
          render={<Link href="/admin/core/staff/moderators/create" />}
        >
          <PlusIcon />
          {t("create")}
        </Button>
      </HeaderContent>
      <React.Suspense fallback={<DataTableSkeleton columns={5} />}>
        <StaffTableAdmin type="moderators" {...props} />
      </React.Suspense>
    </div>
  );
};
