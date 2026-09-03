"use client";

import { useTranslations } from "use-intl";

import { HeaderContent } from "@/components/ui/header-content";

export const OverviewSettings = () => {
  const t = useTranslations("core.auth.settings.nav");

  return <HeaderContent h2={t("overview")} />;
};
