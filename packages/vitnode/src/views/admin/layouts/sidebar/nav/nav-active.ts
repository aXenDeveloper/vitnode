import type { AdminNavItem, AdminNavSubItem } from "./nav-model";

import { normalizeUrl } from "../../normalize-url";

export const isPathnameUnderHref = (
  pathname: string,
  href: string,
): boolean => {
  const normalizedPathname = normalizeUrl(pathname);
  const normalizedHref = normalizeUrl(href);

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
};

/** Whether this exact entry is the page being shown. */
export const isNavItemActive = (pathname: string, href: string): boolean =>
  normalizeUrl(pathname) === normalizeUrl(href);

/**
 * The sub-item the current pathname belongs to, or `null`.
 *
 * **Longest match wins**, which is the whole reason this is not a `find`. A
 * parent's sub-items routinely nest - `/admin/core/users` and
 * `/admin/core/users/roles` are siblings in the sidebar but ancestor and
 * descendant in the URL - so on `/admin/core/users/roles` both are "under" the
 * pathname and a first-match rule highlights whichever happens to be declared
 * first. Comparing lengths picks the one that actually describes the page.
 *
 * Drives two things at once: which sub-item is highlighted, and whether the
 * parent's collapsible starts open.
 */
export const activeChildHref = (
  pathname: string,
  items: readonly AdminNavSubItem[],
): null | string =>
  items.reduce<null | string>((best, item) => {
    if (!isPathnameUnderHref(pathname, item.href)) return best;
    if (best === null) return item.href;

    return normalizeUrl(item.href).length > normalizeUrl(best).length
      ? item.href
      : best;
  }, null);

/**
 * Everything one rendered entry needs to know about where the visitor is.
 *
 * Returned together rather than computed at three call sites, because the three
 * answers have to agree: a parent that reports `hasActiveChild` while
 * `activeChild` is `null` would open a collapsible with nothing highlighted in
 * it.
 */
export const navItemActivity = (
  pathname: string,
  item: Pick<AdminNavItem, "href" | "items">,
): {
  activeChild: null | string;
  hasActiveChild: boolean;
  isActive: boolean;
} => {
  const activeChild = activeChildHref(pathname, item.items ?? []);

  return {
    activeChild,
    hasActiveChild: activeChild !== null,
    isActive: isNavItemActive(pathname, item.href),
  };
};
