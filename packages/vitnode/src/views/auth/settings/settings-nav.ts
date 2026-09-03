import { normalizeUrl } from "@/lib/utils";

/** Where the settings screens are rooted, and the mobile "back" destination. */
export const SETTINGS_ROOT_HREF = "/settings";

export type SettingsNavKey = "devices" | "overview" | "security";

export interface SettingsNavItem {
  aliases: readonly string[];
  href: string;
  /** The `core.auth.settings.nav` key this item's label comes from. */
  key: SettingsNavKey;
}

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    aliases: [SETTINGS_ROOT_HREF],
    href: "/settings/overview",
    key: "overview",
  },
  { aliases: [], href: "/settings/devices", key: "devices" },
  { aliases: [], href: "/settings/security", key: "security" },
];

export const isSettingsRootPath = (pathname: string): boolean =>
  normalizeUrl(pathname) === SETTINGS_ROOT_HREF;

/** Whether one navigation item is the panel `pathname` is showing. */
export const isSettingsNavItemActive = (
  item: SettingsNavItem,
  pathname: string,
): boolean =>
  [item.href, ...item.aliases].some(
    href => normalizeUrl(href) === normalizeUrl(pathname),
  );

export const activeSettingsNavKey = (
  pathname: string,
): SettingsNavKey | undefined =>
  SETTINGS_NAV_ITEMS.find(item => isSettingsNavItemActive(item, pathname))?.key;

/** One navigation item's own href, by key. */
export const settingsNavHref = (key: SettingsNavKey): string =>
  SETTINGS_NAV_ITEMS.find(item => item.key === key)?.href ??
  `${SETTINGS_ROOT_HREF}/${key}`;
