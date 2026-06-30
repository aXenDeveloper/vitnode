import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { Link } from "@/lib/navigation";

import { CreateStaffPermissionsForm } from "./form";

export const CreateStaffPermissionsView = async ({
  type,
}: {
  type: PermissionStaffType;
}) => {
  const t = await getTranslations("admin.staff.create");

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
