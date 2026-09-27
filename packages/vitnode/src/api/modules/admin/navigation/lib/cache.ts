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

export const NAVIGATION_CACHE_KEY = "navigation";

export const NAVIGATION_BOTTOM_BAR_CACHE_KEY = "navigation:bottom_bar";

export const NAVIGATION_CACHE_TTL_SECONDS = 60 * 60 * 24;

export const loadPublicNavigation = async (
  c: Context,
): Promise<PublicNavigationNode[]> =>
  await c
    .get("cache")
    .remember(NAVIGATION_CACHE_KEY, NAVIGATION_CACHE_TTL_SECONDS, async () =>
      toPublicNavigation(
        await readNavigationRecords(c),
        c.get("core").navigation,
      ),
    );

export const loadPublicBottomBar = async (
  c: Context,
): Promise<PublicNavigationItem[]> =>
  await c
    .get("cache")
    .remember(
      NAVIGATION_BOTTOM_BAR_CACHE_KEY,
      NAVIGATION_CACHE_TTL_SECONDS,
      async () =>
        toPublicBottomBar(
          await readNavigationRecords(c),
          c.get("core").navigation,
        ),
    );

export const expireNavigationCache = async (c: Context): Promise<void> => {
  await c
    .get("cache")
    .delete([NAVIGATION_CACHE_KEY, NAVIGATION_BOTTOM_BAR_CACHE_KEY]);
};
