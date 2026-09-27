import type { HeaderNavChildItem, HeaderNavItem } from "../header-nav";

export const navigationOutsideBottomBar = (
  navigation: readonly HeaderNavItem[],
  bottomBar: readonly HeaderNavChildItem[],
): HeaderNavItem[] => {
  const inBar = new Set(bottomBar.map(item => item.href));

  return navigation.filter(
    item => Boolean(item.items?.length) || !inBar.has(item.href),
  );
};
