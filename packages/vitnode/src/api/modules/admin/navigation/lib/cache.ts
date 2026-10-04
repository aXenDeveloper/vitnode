import type { Context } from "hono";

import type {
  PublicNavigationItem,
  PublicNavigationNode,
} from "@/lib/navigation";

import {
  readNavigationRecords,
  toPublicBottomBar,
  toPublicNavigation,
} from "./read-navigation";

export const PUBLIC_NAVIGATION_CACHE_KEY = "navigation:public";

export const NAVIGATION_CACHE_TTL_SECONDS = 60 * 60 * 24;

export interface PublicNavigationMenus {
  bottomBar: PublicNavigationItem[];
  navigation: PublicNavigationNode[];
}

const readPublicNavigationMenus = async (
  c: Context,
): Promise<PublicNavigationMenus> => {
  const records = await readNavigationRecords(c);
  const presets = c.get("core").navigation;

  return {
    bottomBar: toPublicBottomBar(records, presets),
    navigation: toPublicNavigation(records, presets),
  };
};

export const loadPublicNavigationMenus = async (
  c: Context,
): Promise<PublicNavigationMenus> =>
  await c
    .get("cache")
    .remember(
      PUBLIC_NAVIGATION_CACHE_KEY,
      NAVIGATION_CACHE_TTL_SECONDS,
      async () => readPublicNavigationMenus(c),
    );

export const expireNavigationCache = async (c: Context): Promise<void> => {
  await c.get("cache").delete(PUBLIC_NAVIGATION_CACHE_KEY);
};
