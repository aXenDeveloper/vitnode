import { getTranslations } from "next-intl/server";

import { BreadcrumbMain } from "@/views/breadcrumb/breadcrumb-main";

export default async function BreadcrumbSlot() {
  const t = await getTranslations("core.global");

  return (
    <BreadcrumbMain
      labels={{ "/register": t("register") }}
      segments={["register"]}
    />
  );
}
