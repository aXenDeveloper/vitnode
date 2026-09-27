import type {
  NavigationTranslate,
  PublicNavigationItem,
  PublicNavigationNode,
} from "@/lib/navigation";

import { navigationItemLabels, navigationNamespaces } from "@/lib/navigation";

export const HEADER_HREF = {
  home: "/",
} as const;

export interface HeaderNavChildItem {
  description?: string;
  href: string;
  icon?: string;
  id: string;
  isOpenInNewTab?: boolean;
  label: string;
}

export interface HeaderNavItem extends HeaderNavChildItem {
  items?: HeaderNavChildItem[];
}

export type HeaderNavTranslate = NavigationTranslate;

const headerNavChildFrom = (
  item: PublicNavigationItem,
  locale: string,
  translate: HeaderNavTranslate,
): HeaderNavChildItem | null => {
  const { description, title } = navigationItemLabels({
    item,
    locale,
    translate,
  });
  if (!title) return null;

  return {
    href: item.href,
    id: String(item.id),
    label: title,
    ...(description ? { description } : {}),
    ...(item.icon ? { icon: item.icon } : {}),
    ...(item.isOpenInNewTab ? { isOpenInNewTab: true } : {}),
  };
};

export const headerNavItemsFrom = ({
  items,
  locale,
  translate,
}: {
  items: readonly PublicNavigationNode[];
  locale: string;
  translate: HeaderNavTranslate;
}): HeaderNavItem[] =>
  items.flatMap(node => {
    const entry = headerNavChildFrom(node, locale, translate);
    if (!entry) return [];

    const children = node.items.flatMap(child => {
      const childEntry = headerNavChildFrom(child, locale, translate);

      return childEntry ? [childEntry] : [];
    });

    return [children.length > 0 ? { ...entry, items: children } : entry];
  });

export const headerNavNamespaces = (
  items: readonly PublicNavigationNode[],
  fallback: string,
): string[] => {
  const namespaces = navigationNamespaces(items);

  return namespaces.length > 0 ? namespaces : [fallback];
};

export const visibleHeaderNavCount = ({
  availableWidth,
  gap,
  itemWidths,
  moreWidth,
}: {
  availableWidth: number;
  gap: number;
  itemWidths: readonly number[];
  moreWidth: number;
}): number => {
  const totalWidth = itemWidths.reduce(
    (sum, width, index) => sum + width + (index > 0 ? gap : 0),
    0,
  );
  if (totalWidth <= availableWidth) return itemWidths.length;

  let usedWidth = moreWidth;
  let count = 0;
  for (const width of itemWidths) {
    if (usedWidth + gap + width > availableWidth) break;
    usedWidth += gap + width;
    count += 1;
  }

  return count;
};
