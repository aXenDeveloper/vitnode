import { getTranslations } from "next-intl/server";

import { BreadcrumbMain } from "@vitnode/core/views/breadcrumb/breadcrumb-main";

export default async function BreadcrumbSlot() {
  const t = await getTranslations("core.global");

  return (
    <BreadcrumbMain labels={{ "/login": t("login") }} segments={["login"]} />
  );
}
