import type { NavAdminParent } from "../sidebar/nav/nav-model";

import { normalizeUrl } from "../normalize-url";

export interface AdminSearchNavItem {
  groupTitle: string;
  href: string;
  icon?: React.ReactNode;
  isOpenInNewTab?: boolean;
  parentTitle?: string;
  searchText: string;
  title: string;
}

export const flattenAdminNav = (
  nav: NavAdminParent[],
): AdminSearchNavItem[] => {
  const items: AdminSearchNavItem[] = [];
  const seen = new Set<string>();

  const push = (item: Omit<AdminSearchNavItem, "searchText">) => {
    const key = normalizeUrl(item.href);
    if (seen.has(key)) return;
    seen.add(key);

    items.push({
      ...item,
      searchText: buildSearchText([
        item.title,
        item.parentTitle,
        item.groupTitle,
      ]),
    });
  };

  for (const group of nav) {
    for (const item of group.items) {
      if (item.items?.length) {
        for (const subItem of item.items) {
          push({
            groupTitle: group.title,
            href: subItem.href,
            icon: item.icon,
            isOpenInNewTab: subItem.isOpenInNewTab,
            parentTitle: item.title,
            title: subItem.title,
          });
        }

        continue;
      }

      push({
        groupTitle: group.title,
        href: item.href,
        icon: item.icon,
        isOpenInNewTab: item.isOpenInNewTab,
        title: item.title,
      });
    }
  }

  return items;
};

export const buildSearchText = (parts: (string | undefined)[]): string =>
  [
    ...new Set(
      parts
        .filter((part): part is string => Boolean(part))
        .map(part => part.toLowerCase()),
    ),
  ].join(" ");

export const matchesAdminNavItem = (
  item: AdminSearchNavItem,
  query: string,
): boolean => {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;

  return tokens.every(token => item.searchText.includes(token));
};
