import type { NavigationLocation } from "@/lib/navigation";

import { NAVIGATION_BOTTOM_BAR_MAX_ITEMS } from "@/lib/navigation";

export const NAVIGATION_LOCATION_ERRORS = {
  bottomBarFull: `The bottom bar holds at most ${NAVIGATION_BOTTOM_BAR_MAX_ITEMS} links`,
  bottomBarNested: "The bottom bar has no dropdowns",
  otherLocation: "A menu item can only be nested inside its own menu",
} as const;

export type NavigationLocationProblem = keyof typeof NAVIGATION_LOCATION_ERRORS;

export const isNestableLocation = (location: NavigationLocation): boolean =>
  location === "header";

export const navigationCapacityProblem = ({
  count,
  location,
}: {
  count: number;
  location: NavigationLocation;
}): NavigationLocationProblem | null =>
  location === "bottom_bar" && count >= NAVIGATION_BOTTOM_BAR_MAX_ITEMS
    ? "bottomBarFull"
    : null;

export const navigationPlacementProblem = ({
  location,
  parentId,
  parentLocation,
}: {
  location: NavigationLocation;
  parentId: null | number;
  parentLocation?: NavigationLocation;
}): NavigationLocationProblem | null => {
  if (parentId === null) return null;
  if (!isNestableLocation(location)) return "bottomBarNested";
  if (parentLocation !== undefined && parentLocation !== location) {
    return "otherLocation";
  }

  return null;
};

export const navigationOrderProblem = ({
  items,
  location,
}: {
  items: readonly { children: readonly number[] }[];
  location: NavigationLocation;
}): NavigationLocationProblem | null =>
  !isNestableLocation(location) && items.some(item => item.children.length > 0)
    ? "bottomBarNested"
    : null;

export const navigationLocationOf = (value: string): NavigationLocation =>
  value === "bottom_bar" ? "bottom_bar" : "header";
