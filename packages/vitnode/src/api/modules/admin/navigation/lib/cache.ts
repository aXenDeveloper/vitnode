import type { Context } from "hono";

import type { PublicNavigationNode } from "@/lib/navigation";

import { readNavigationRecords, toPublicNavigation } from "./read-navigation";

export const NAVIGATION_CACHE_KEY = "navigation";

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

export const expireNavigationCache = async (c: Context): Promise<void> => {
  await c.get("cache").delete(NAVIGATION_CACHE_KEY);
};
