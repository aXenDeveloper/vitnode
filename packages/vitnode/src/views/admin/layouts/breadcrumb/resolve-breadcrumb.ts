import { type BreadcrumbCrumb, humanize } from "@/views/breadcrumb/crumb";

import type { NavAdminParent } from "../sidebar/nav/get-admin-nav";

export type { BreadcrumbCrumb };

// Mirror the trailing-slash normalization used by the sidebar nav so hrefs like
// "/admin/core/" and "/admin/core" resolve to the same key.
const normalizeUrl = (url: string): string =>
  url.endsWith("/") && url.length > 1 ? url.slice(0, -1) : url;

// Flatten the nav tree into a `normalizedHref -> translated title` lookup,
// including nested sub-items. First writer wins, so a parent item keeps its
// label when a sub-item points at the same href (e.g. "Users" vs "User List"
// both at /admin/core/users) — better breadcrumb hierarchy.
const flattenNav = (nav: NavAdminParent[]): Map<string, string> => {
  const labels = new Map<string, string>();
  const setIfAbsent = (href: null | string | undefined, title: string) => {
    if (href == null) return;

    const key = normalizeUrl(href);
    if (!labels.has(key)) labels.set(key, title);
  };

  for (const parent of nav) {
    for (const item of parent.items) {
      setIfAbsent(item.href, item.title);

      for (const subItem of item.items ?? []) {
        setIfAbsent(subItem.href, subItem.title);
      }
    }
  }

  return labels;
};

/**
 * Turns the path segments after `/admin` into breadcrumb crumbs, resolving each
 * cumulative path against the already-translated admin nav. Segments without a
 * nav match fall back to a humanized label and render as plain text.
 */
export const resolveBreadcrumb = (
  nav: NavAdminParent[],
  segments: string[],
): BreadcrumbCrumb[] => {
  const labels = flattenNav(nav);

  return segments.map((segment, index) => {
    const href = `/admin/${segments.slice(0, index + 1).join("/")}`;
    const known = labels.get(normalizeUrl(href));
    const isCurrent = index === segments.length - 1;

    return {
      href,
      isCurrent,
      isKnown: known !== undefined,
      isLink: known !== undefined && !isCurrent,
      label: known ?? humanize(segment),
    };
  });
};
