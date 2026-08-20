import { getTranslations } from "next-intl/server";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { BreadcrumbAdmin } from "./breadcrumb-admin";

/**
 * Takes `params` as the promise the slot was handed rather than the resolved
 * id: awaiting it above the slot's `<Suspense>` would pull the URL back into
 * the AdminCP's shared App Shell.
 */
export const BreadcrumbStaffEditAdmin = async ({
  type,
  params,
}: {
  params: Promise<{ id: string }>;
  type: PermissionStaffType;
}) => {
  const [{ id }, t] = await Promise.all([
    params,
    getTranslations("admin.staff"),
  ]);
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
