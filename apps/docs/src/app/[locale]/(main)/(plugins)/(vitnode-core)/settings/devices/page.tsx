import { getTranslations } from "next-intl/server";

import { DevicesSettings } from "@vitnode/core/views/auth/settings/devices/devices";

export const generateMetadata = async () => {
  const t = await getTranslations("core.auth.settings");

  return {
    title: `${t("nav.devices")} - ${t("title")}`,
  };
};

export default function Page() {
  return <DevicesSettings />;
}
