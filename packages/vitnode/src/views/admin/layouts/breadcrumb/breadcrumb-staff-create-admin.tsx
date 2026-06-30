import { getTranslations } from "next-intl/server";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { BreadcrumbAdmin } from "./breadcrumb-admin";

export const BreadcrumbStaffCreateAdmin = async ({
  type,
}: {
  type: PermissionStaffType;
}) => {
  const [t, tCreate] = await Promise.all([
    getTranslations("admin.staff"),
    getTranslations("admin.staff.create"),
  ]);
  const tab = type === "admin" ? "admins" : "moderators";

  return (
    <BreadcrumbAdmin
      labels={{
        "/admin/core/staff": t("title"),
        [`/admin/core/staff/${tab}`]: t(`tabs.${tab}`),
      }}
      overrideLastLabel={tCreate("button")}
      segments={["core", "staff", tab, "create"]}
    />
  );
};
