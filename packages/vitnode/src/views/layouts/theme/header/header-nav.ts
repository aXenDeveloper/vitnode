import type {
  NavigationHeaderItemConfig,
  NavigationIcon,
  NavigationLinkConfig,
} from "@/lib/navigation";

export const HEADER_HREF = {
  home: "/",
} as const;

export interface HeaderNavChildItem {
  description?: string;
  href: string;
  icon?: NavigationIcon;
  id: string;
  isOpenInNewTab?: boolean;
  label: string;
}

export interface HeaderNavItem extends HeaderNavChildItem {
  items?: HeaderNavChildItem[];
}

export type HeaderNavTranslate = (key: string) => string | undefined;

const headerNavChildFrom = (
  link: NavigationLinkConfig,
  id: string,
  translate: HeaderNavTranslate,
): HeaderNavChildItem => {
  const description =
    link.description === undefined ? undefined : translate(link.description);

  return {
    href: link.href,
    id,
    label: translate(link.title) ?? link.title,
    ...(description ? { description } : {}),
    ...(link.icon ? { icon: link.icon } : {}),
    ...(link.isOpenInNewTab ? { isOpenInNewTab: true } : {}),
  };
};

export const headerNavItemsFrom = ({
  items,
  translate,
}: {
  items: readonly NavigationHeaderItemConfig[] | undefined;
  translate: HeaderNavTranslate;
}): HeaderNavItem[] =>
  (items ?? []).map((item, index) => {
    const id = String(index);
    const entry = headerNavChildFrom(item, id, translate);
    const children = (item.items ?? []).map((child, childIndex) =>
      headerNavChildFrom(child, `${id}.${String(childIndex)}`, translate),
    );

    return children.length > 0 ? { ...entry, items: children } : entry;
  });

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
