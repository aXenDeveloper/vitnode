import { getTranslations } from "next-intl/server";

import { BreadcrumbMain } from "@vitnode/core/views/breadcrumb/breadcrumb-main";

export default async function BreadcrumbSlot() {
  const t = await getTranslations("core.auth.settings");

  return (
    <BreadcrumbMain
      labels={{ "/settings": t("title") }}
      segments={["settings"]}
    />
  );
}
