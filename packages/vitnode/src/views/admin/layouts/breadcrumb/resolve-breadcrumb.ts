import { type BreadcrumbCrumb, humanize } from "@/views/breadcrumb/crumb";

import type { NavAdminParent } from "../sidebar/nav/nav-model";

import { normalizeUrl } from "../normalize-url";

export type { BreadcrumbCrumb };

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

const navItemLabel = (
  nav: NavAdminParent[],
  href: string,
): string | undefined => {
  const key = normalizeUrl(href);
  for (const parent of nav) {
    for (const item of parent.items) {
      if (item.href != null && normalizeUrl(item.href) === key) {
        return item.title;
      }
      for (const subItem of item.items ?? []) {
        if (subItem.href != null && normalizeUrl(subItem.href) === key) {
          return subItem.title;
        }
      }
    }
  }

  return undefined;
};

export const appendPageCrumb = (
  nav: NavAdminParent[],
  crumbs: BreadcrumbCrumb[],
): BreadcrumbCrumb[] => {
  const last = crumbs.at(-1);
  if (!last) return crumbs;

  const label = navItemLabel(nav, last.href);
  if (label === undefined || label === last.label) return crumbs;

  return [
    ...crumbs.slice(0, -1),
    { ...last, isCurrent: false, isLink: false },
    { href: last.href, isCurrent: true, isKnown: true, isLink: false, label },
  ];
};
