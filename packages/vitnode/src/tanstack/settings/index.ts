export { SettingsLayoutContent } from "./layout";

export { OverviewSettings } from "./overview";
export * from "./route";

export type { SettingsNavKey } from "./route";

export type { SettingsOverviewUser } from "@/views/auth/settings/overview/overview";
export { OverviewSettingsContent } from "@/views/auth/settings/overview/overview";
export { SecuritySettings } from "@/views/auth/settings/security/security";

export type { SettingsBreadcrumbContentProps } from "@/views/auth/settings/settings-breadcrumb-content";
export { SettingsBreadcrumbContent } from "@/views/auth/settings/settings-breadcrumb-content";
export {
  activeSettingsNavKey,
  isSettingsNavItemActive,
  SETTINGS_NAV_ITEMS,
  SETTINGS_ROOT_HREF,
  settingsNavHref,
} from "@/views/auth/settings/settings-nav";
