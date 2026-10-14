import type { Context } from "hono";

import { createHash } from "node:crypto";

import type {
  NavigationPreset,
  PublicNavigationItem,
  PublicNavigationNode,
} from "@/lib/navigation";

import {
  readNavigationRecords,
  toPublicBottomBar,
  toPublicNavigation,
} from "./read-navigation";

export const PUBLIC_NAVIGATION_CACHE_KEY = "navigation:public";

export const NAVIGATION_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface PublicNavigationMenus {
  bottomBar: PublicNavigationItem[];
  navigation: PublicNavigationNode[];
}

const presetFingerprints = new WeakMap<readonly NavigationPreset[], string>();

const presetFingerprintOf = (presets: readonly NavigationPreset[]): string => {
  const known = presetFingerprints.get(presets);
  if (known) return known;

  const fingerprint = createHash("sha256")
    .update(JSON.stringify(presets))
    .digest("hex")
    .slice(0, 16);
  presetFingerprints.set(presets, fingerprint);

  return fingerprint;
};

export const publicNavigationCacheKey = (
  presets: readonly NavigationPreset[],
): string => `${PUBLIC_NAVIGATION_CACHE_KEY}:${presetFingerprintOf(presets)}`;

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
      publicNavigationCacheKey(c.get("core").navigation),
      NAVIGATION_CACHE_TTL_SECONDS,
      async () => readPublicNavigationMenus(c),
    );

export const expireNavigationCache = async (c: Context): Promise<void> => {
  await c
    .get("cache")
    .delete(publicNavigationCacheKey(c.get("core").navigation));
};
