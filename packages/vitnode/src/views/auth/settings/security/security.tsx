import { getTranslations } from "next-intl/server";

import { HeaderContent } from "@/components/ui/header-content";

export const SecuritySettings = async () => {
  const t = await getTranslations("core.auth.settings.nav");

  return <HeaderContent h2={t("security")} />;
};
