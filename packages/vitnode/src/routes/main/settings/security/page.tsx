import { getTranslations } from "next-intl/server";

import { SecuritySettings } from "@/views/auth/settings/security/security";

export const generateMetadata = async () => {
  const t = await getTranslations("core.auth.settings");

  return {
    title: `${t("nav.security")} - ${t("title")}`,
  };
};

export default function Page() {
  return <SecuritySettings />;
}
