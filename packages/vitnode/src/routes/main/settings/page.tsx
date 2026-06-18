import { getTranslations } from "next-intl/server";

import { OverviewSettings } from "@/views/auth/settings/overview/overview";

export const generateMetadata = async () => {
  const t = await getTranslations("core.auth.settings");

  return {
    title: `${t("nav.overview")} - ${t("title")}`,
  };
};

export default function Page() {
  return <OverviewSettings />;
}
