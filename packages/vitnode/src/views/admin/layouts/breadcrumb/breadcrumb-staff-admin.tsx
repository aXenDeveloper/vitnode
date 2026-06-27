import { getTranslations } from "next-intl/server";

import type { VitNodeConfig } from "@/vitnode.config";

import { BreadcrumbAdmin } from "./breadcrumb-admin";

export const BreadcrumbStaffAdmin = async ({
  tab,
  vitNodeConfig,
}: {
  tab: "admins" | "moderators";
  vitNodeConfig?: VitNodeConfig;
}) => {
  const t = await getTranslations("admin.staff");

  return (
    <BreadcrumbAdmin
      labels={{
        "/admin/core/users/staff": t("title"),
        [`/admin/core/users/staff/${tab}`]: t(`tabs.${tab}`),
      }}
      segments={["core", "users", "staff", tab]}
      vitNodeConfig={vitNodeConfig}
    />
  );
};
