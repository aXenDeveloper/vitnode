import { useTranslations } from "use-intl";

import type { SettingsNavKey } from "./settings-nav";

export interface SettingsBreadcrumbContentProps {
  /** The panel this crumb is for. Absent is the settings frame's own crumb. */
  navKey?: SettingsNavKey;
}

export const SettingsBreadcrumbContent = ({
  navKey,
}: SettingsBreadcrumbContentProps) => {
  const t = useTranslations("core.auth.settings");
  const tNav = useTranslations("core.auth.settings.nav");

  return <>{navKey === undefined ? t("title") : tNav(navKey)}</>;
};
