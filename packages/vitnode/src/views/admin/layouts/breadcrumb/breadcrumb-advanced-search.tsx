import { getTranslations } from "next-intl/server";

import type { VitNodeConfig } from "@/vitnode.config";

import { BreadcrumbAdmin } from "./breadcrumb-admin";

export const BreadcrumbAdvancedSearch = async ({
  vitNodeConfig,
}: {
  vitNodeConfig?: VitNodeConfig;
}) => {
  const t = await getTranslations("admin.global.nav.advanced");

  return (
    <BreadcrumbAdmin
      labels={{
        "/admin/core/advanced": t("title"),
        "/admin/core/advanced/search": t("search"),
      }}
      segments={["core", "advanced", "search"]}
      vitNodeConfig={vitNodeConfig}
    />
  );
};
