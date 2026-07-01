import { getTranslations } from "next-intl/server";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { BreadcrumbAdmin } from "./breadcrumb-admin";

export const BreadcrumbStaffEditAdmin = async ({
  type,
  id,
}: {
  id: string;
  type: PermissionStaffType;
}) => {
  const t = await getTranslations("admin.staff");
  const tab = type === "admin" ? "admins" : "moderators";

  return (
    <BreadcrumbAdmin
      labels={{
        "/admin/core/staff": t("title"),
        [`/admin/core/staff/${tab}`]: t(`tabs.${tab}`),
      }}
      overrideLastLabel={t("edit.title")}
      segments={["core", "staff", tab, id]}
    />
  );
};
