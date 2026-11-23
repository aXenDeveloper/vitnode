import { normalizeUrl } from "@/lib/utils";

/** Where the settings screens are rooted, and the overview panel's own URL. */
export const SETTINGS_ROOT_HREF = "/settings";

export type SettingsNavKey =
  | "ai"
  | "devices"
  | "notifications"
  | "overview"
  | "privacy"
  | "security"
  | "sso"
  | "standing";

/** The `core.auth.settings.nav_groups` key a group's heading comes from, in display order. */
export const SETTINGS_NAV_GROUPS = [
  "account",
  "preferences",
  "safety",
] as const;

export type SettingsNavGroupKey = (typeof SETTINGS_NAV_GROUPS)[number];

export interface SettingsNavItem {
  /** The heading the item is listed under. */
  group: SettingsNavGroupKey;
  href: string;
  /** The `core.auth.settings.nav` key this item's label comes from. */
  key: SettingsNavKey;
}

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  { group: "account", href: SETTINGS_ROOT_HREF, key: "overview" },
  {
    group: "preferences",
    href: "/settings/notifications",
    key: "notifications",
  },
  { group: "account", href: "/settings/devices", key: "devices" },
  { group: "account", href: "/settings/security", key: "security" },
  { group: "account", href: "/settings/sso", key: "sso" },
  { group: "preferences", href: "/settings/ai", key: "ai" },
  { group: "safety", href: "/settings/standing", key: "standing" },
  { group: "safety", href: "/settings/privacy", key: "privacy" },
];

/** The items under each non-empty group, groups in display order. */
export const groupSettingsNavItems = (
  items: readonly SettingsNavItem[],
): { items: SettingsNavItem[]; key: SettingsNavGroupKey }[] =>
  SETTINGS_NAV_GROUPS.map(key => ({
    items: items.filter(item => item.group === key),
    key,
  })).filter(group => group.items.length > 0);

export const visibleSettingsNavItems = ({
  ai,
  aiFeatures = true,
  passkeys,
  sso = [],
}: {
  ai?: { models: readonly unknown[] };
  aiFeatures?: boolean;
  passkeys: boolean;
  sso?: readonly unknown[];
}): readonly SettingsNavItem[] =>
  SETTINGS_NAV_ITEMS.filter(
    item =>
      (item.key !== "security" || passkeys) &&
      (item.key !== "sso" || sso.length > 0) &&
      (item.key !== "ai" || ((ai?.models.length ?? 0) > 0 && aiFeatures)),
  );

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
