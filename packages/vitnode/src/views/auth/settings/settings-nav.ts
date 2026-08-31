import { normalizeUrl } from "@/lib/utils";

/**
 * The settings screens, as data rather than as markup.
 *
 * Two decisions live here and nowhere else: which panels the settings navigation
 * offers, and which one of them a given path is on. Both are plain functions
 * over strings - no router, no request, no React - because both frameworks have
 * to reach the same answer from the URL each of them happens to hold, and a
 * highlighted nav item disagreeing with the panel on screen is the kind of bug
 * that only shows up on one of the two.
 *
 * What this is *not*: a route table. Neither framework learns which routes exist
 * from this file - Next.js has `routes/main/settings/*` and TanStack Start has
 * `routes/_main/_authenticated/settings/*`, and a panel that is not routed
 * simply renders a link to a 404. The list is the navigation's contents, which
 * is a product decision, and it is shared so the two navigations cannot offer
 * different menus.
 */

/** Where the settings screens are rooted, and the mobile "back" destination. */
export const SETTINGS_ROOT_HREF = "/settings";

export type SettingsNavKey = "devices" | "overview" | "security";

export interface SettingsNavItem {
  /**
   * Paths that light this item up without being its own href.
   *
   * `/settings` is the only one, and it exists because the root path renders the
   * overview panel rather than redirecting to it - see the note on
   * {@link SETTINGS_NAV_ITEMS}. Without the alias, the root screen would show a
   * navigation with nothing selected.
   */
  aliases: readonly string[];
  href: string;
  /** The `core.auth.settings.nav` key this item's label comes from. */
  key: SettingsNavKey;
}

/**
 * The settings navigation, in the order it is rendered.
 *
 * `/settings` is an alias of the overview panel rather than a redirect to it,
 * and that is deliberate on both sides of the seam. The shell shows the
 * navigation *instead of* the panel on a narrow screen (see
 * {@link isSettingsRootPath}), so a visitor who lands on `/settings` from a
 * phone is looking at a menu; redirecting them to `/settings/overview` would
 * skip the menu entirely and leave the back link as the only way to reach it.
 */
export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    aliases: [SETTINGS_ROOT_HREF],
    href: "/settings/overview",
    key: "overview",
  },
  { aliases: [], href: "/settings/devices", key: "devices" },
  { aliases: [], href: "/settings/security", key: "security" },
];

/**
 * Whether `pathname` is the settings root.
 *
 * The pathname must already be *internal* - no locale prefix. Next.js gets that
 * from `next-intl`'s `usePathname`, TanStack Start from a router location the
 * Stage 3 rewrite has stripped. Nothing here localizes anything, and nothing
 * here may start to: a rule that compared against `/pl/settings` would be a
 * second copy of the locale routing.
 */
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

/**
 * Which panel `pathname` is on, or nothing.
 *
 * `undefined` for a path outside the settings screens, and for a settings path
 * with no navigation entry - a future panel reachable by URL before it is
 * listed. The navigation renders nothing selected in both cases, which is the
 * honest answer.
 */
export const activeSettingsNavKey = (
  pathname: string,
): SettingsNavKey | undefined =>
  SETTINGS_NAV_ITEMS.find(item => isSettingsNavItemActive(item, pathname))?.key;

/** One navigation item's own href, by key. */
export const settingsNavHref = (key: SettingsNavKey): string =>
  SETTINGS_NAV_ITEMS.find(item => item.key === key)?.href ??
  `${SETTINGS_ROOT_HREF}/${key}`;
