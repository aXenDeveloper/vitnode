import { getTranslations } from "next-intl/server";

import { BreadcrumbMain } from "@/views/breadcrumb/breadcrumb-main";

export default async function BreadcrumbSlot() {
  const t = await getTranslations("core.search");

  return (
    <BreadcrumbMain
      labels={{ "/discover": t("discoverTitle") }}
      segments={["discover"]}
    />
  );
}
