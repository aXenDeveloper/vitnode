import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { staffPermissionModuleByType } from "@/api/modules/admin/staff/lib/schema";
import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { notFound } from "@/framework/navigation";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { Link } from "@/lib/navigation";

import { CreateStaffPermissionsForm } from "./form";

export const CreateStaffPermissionsView = async ({
  type,
}: {
  type: PermissionStaffType;
}) => {
  const [t, canCreate] = await Promise.all([
    getTranslations("admin.staff.create"),
    checkAdminPermissionApi({
      module: staffPermissionModuleByType[type],
      permission: "can_create",
    }),
  ]);

  if (!canCreate) {
    notFound();
  }

  const backHref =
    type === "admin"
      ? "/admin/core/staff/admins"
      : "/admin/core/staff/moderators";

  return (
    <>
      <HeaderContent
        desc={t("desc")}
        h1={t(type === "admin" ? "admins" : "moderators")}
      >
        <Button
          nativeButton={false}
          render={<Link href={backHref} />}
          variant="outline"
        >
          <ArrowLeftIcon />
          {t("back")}
        </Button>
      </HeaderContent>

      <CreateStaffPermissionsForm type={type} />
    </>
  );
};
