import type { NavigationLocation } from "@/lib/navigation";

import {
  NAVIGATION_BOTTOM_BAR_MAX_ITEMS,
  navigationPresetKey,
} from "@/lib/navigation";

import type { AdminNavigationItem } from "./navigation-query";

export const usedNavigationPresetKeys = (
  items: readonly AdminNavigationItem[],
  except?: number,
): string[] =>
  items.flatMap(item =>
    item.kind === "preset" &&
    item.pluginId &&
    item.presetId &&
    item.id !== except
      ? [navigationPresetKey(item.pluginId, item.presetId)]
      : [],
  );

export const isNavigationLocationFull = (
  location: NavigationLocation,
  items: readonly AdminNavigationItem[],
): boolean =>
  location === "bottom_bar" &&
  items.filter(item => item.parentId === null).length >=
    NAVIGATION_BOTTOM_BAR_MAX_ITEMS;
