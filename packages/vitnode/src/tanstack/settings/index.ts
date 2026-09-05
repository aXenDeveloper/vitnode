export { SettingsLayoutContent } from "./layout";

export * from "./route";
export type { SettingsNavKey } from "./route";

export { OverviewSettings } from "@/views/auth/settings/overview/overview";
export { SecuritySettings } from "@/views/auth/settings/security/security";

export type { SettingsBreadcrumbContentProps } from "@/views/auth/settings/settings-breadcrumb-content";
export { SettingsBreadcrumbContent } from "@/views/auth/settings/settings-breadcrumb-content";
export {
  activeSettingsNavKey,
  isSettingsNavItemActive,
  isSettingsRootPath,
  SETTINGS_NAV_ITEMS,
  SETTINGS_ROOT_HREF,
  settingsNavHref,
} from "@/views/auth/settings/settings-nav";
