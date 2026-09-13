import { normalizeUrl } from "@/lib/utils";

/** Where the settings screens are rooted, and the overview panel's own URL. */
export const SETTINGS_ROOT_HREF = "/settings";

export type SettingsNavKey = "devices" | "overview" | "security";

export interface SettingsNavItem {
  href: string;
  /** The `core.auth.settings.nav` key this item's label comes from. */
  key: SettingsNavKey;
}

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  { href: SETTINGS_ROOT_HREF, key: "overview" },
  { href: "/settings/devices", key: "devices" },
  { href: "/settings/security", key: "security" },
];

/** Whether one navigation item is the panel `pathname` is showing. */
export const isSettingsNavItemActive = (
  item: SettingsNavItem,
  pathname: string,
): boolean => normalizeUrl(item.href) === normalizeUrl(pathname);

export const activeSettingsNavKey = (
  pathname: string,
): SettingsNavKey | undefined =>
  SETTINGS_NAV_ITEMS.find(item => isSettingsNavItemActive(item, pathname))?.key;

/** One navigation item's own href, by key. */
export const settingsNavHref = (key: SettingsNavKey): string =>
  SETTINGS_NAV_ITEMS.find(item => item.key === key)?.href ??
  `${SETTINGS_ROOT_HREF}/${key}`;
