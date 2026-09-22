import { useTranslations } from "use-intl";

import { PageTitle } from "@/components/ui/page-title";

export const SecuritySettings = () => {
  const t = useTranslations("core.auth.settings.nav");
  const tSettings = useTranslations("core.auth.settings");

  return (
    <PageTitle
      className="mb-0"
      h1={t("security")}
      subtitle={tSettings("title")}
    />
  );
};
