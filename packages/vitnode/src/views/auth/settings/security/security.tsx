import { useTranslations } from "use-intl";

import { PageTitle } from "@/components/ui/page-title";

export const SecuritySettings = () => {
  const t = useTranslations("core.auth.settings.nav");

  return <PageTitle h2={t("security")} />;
};
