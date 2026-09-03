import { useTranslations } from "use-intl";

import type { SettingsNavKey } from "./settings-nav";

export interface SettingsBreadcrumbContentProps {
  /** The panel this crumb is for. Absent is the settings frame's own crumb. */
  navKey?: SettingsNavKey;
}

/**
 * One crumb of the settings trail - a label, and nothing else.
 *
 * The frame at `/settings` contributes "Settings" and each panel contributes its
 * own name, so `/settings/devices` reads `Settings / Devices` without either
 * route knowing how deep it is. The shell owns the separator, the link and the
 * `aria-current`; a crumb that built its own href would need a router, which is
 * exactly what a view may not import.
 *
 * The strings are `core.auth.settings`, the same namespace the panels and the
 * navigation read, so a host has one set to warm rather than a second one for
 * the crumb - and the panel names come from `…settings.nav`, so the trail and the
 * menu name a panel identically in every language.
 */
export const SettingsBreadcrumbContent = ({
  navKey,
}: SettingsBreadcrumbContentProps) => {
  const t = useTranslations("core.auth.settings");
  const tNav = useTranslations("core.auth.settings.nav");

  return <>{navKey === undefined ? t("title") : tNav(navKey)}</>;
};
