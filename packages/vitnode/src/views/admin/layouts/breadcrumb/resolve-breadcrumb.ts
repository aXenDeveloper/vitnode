import { type BreadcrumbCrumb, humanize } from "@/views/breadcrumb/crumb";

import type { NavAdminParent } from "../sidebar/nav/get-admin-nav";

export type { BreadcrumbCrumb };

const normalizeUrl = (url: string): string =>
  url.endsWith("/") && url.length > 1 ? url.slice(0, -1) : url;

const flattenNav = (nav: NavAdminParent[]): Map<string, string> => {
  const labels = new Map<string, string>();
  const setIfAbsent = (href: null | string | undefined, title: string) => {
    if (href == null) return;

    const key = normalizeUrl(href);
    if (!labels.has(key)) labels.set(key, title);
  };

  for (const parent of nav) {
    setIfAbsent(`/admin/${parent.id}`, parent.title);

    for (const item of parent.items) {
      setIfAbsent(item.href, item.title);

      for (const subItem of item.items ?? []) {
        setIfAbsent(subItem.href, subItem.title);
      }
    }
  }

  return labels;
};

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
