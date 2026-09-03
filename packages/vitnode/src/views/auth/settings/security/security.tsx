"use client";

import { useTranslations } from "use-intl";

import { HeaderContent } from "@/components/ui/header-content";

export const SecuritySettings = () => {
  const t = useTranslations("core.auth.settings.nav");

  return <HeaderContent h2={t("security")} />;
};
