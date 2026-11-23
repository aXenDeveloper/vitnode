import type { Context } from "hono";

import { eq } from "drizzle-orm";

import { core_seo_settings } from "@/database/seo";
import { manifest } from "@/manifest";

import type { DomainCache } from "../cache";
import type { SeoSettings } from "./settings";

import { defineCacheEntry } from "../cache-entry";
import { SEO_SETTINGS_DEFAULTS, zodSeoSettings } from "./settings";

const seoSettingsCache = defineCacheEntry({
  pluginId: manifest.id,
  name: "seo.settings",
  version: 1,
  schema: zodSeoSettings,
  ttlSeconds: 300,
});

const cacheOf = (c: Context): DomainCache | undefined => c.get("cache");

const perRequest = new WeakMap<Context, Promise<SeoSettings>>();

type SeoSettingsRow = typeof core_seo_settings.$inferSelect;

const fromRow = (row: SeoSettingsRow | undefined): SeoSettings =>
  row
    ? {
        allowIndexing: row.allowIndexing,
        blockAiCrawlers: row.blockAiCrawlers,
        customRobots: row.customRobots,
        sitemap: {
          disabledSources: row.disabledSitemapSources,
          enabled: row.sitemapEnabled,
          maxUrlsPerFile: row.sitemapMaxUrls,
        },
      }
    : SEO_SETTINGS_DEFAULTS;

const readRow = async (c: Context): Promise<SeoSettings> => {
  const [row] = await c
    .get("db")
    .select()
    .from(core_seo_settings)
    .where(eq(core_seo_settings.id, 1))
    .limit(1);

  return fromRow(row);
};

/**
 * The SEO settings with their defaults, read once per request and shared
 * across requests through the cache. Server-only.
 */
export const loadSeoSettings = async (c: Context): Promise<SeoSettings> => {
  const remembered = perRequest.get(c);
  if (remembered) return await remembered;

  const cache = cacheOf(c);
  const loading = cache
    ? cache.entry(seoSettingsCache).remember(async () => await readRow(c))
    : readRow(c);
  perRequest.set(c, loading);

  return await loading;
};

/**
 * Writes the SEO settings and returns what was saved before (the defaults
 * when there was no row). Run it inside the caller's transaction, then call
 * {@link afterSeoSettingsSaved} once it has committed. Server-only.
 */
export const saveSeoSettings = async (
  tx: Omit<Context["var"]["db"], "$client">,
  settings: SeoSettings,
  userId: number,
): Promise<SeoSettings> => {
  const [before] = await tx
    .select()
    .from(core_seo_settings)
    .where(eq(core_seo_settings.id, 1))
    .limit(1)
    .for("update");
  const values = {
    allowIndexing: settings.allowIndexing,
    blockAiCrawlers: settings.blockAiCrawlers,
    customRobots: settings.customRobots,
    disabledSitemapSources: settings.sitemap.disabledSources,
    sitemapEnabled: settings.sitemap.enabled,
    sitemapMaxUrls: settings.sitemap.maxUrlsPerFile,
    updatedById: userId,
  };

  await tx
    .insert(core_seo_settings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ set: values, target: core_seo_settings.id });

  return fromRow(before);
};

/** Expires the cached SEO settings. Call it after the save has committed. */
export const afterSeoSettingsSaved = async (c: Context): Promise<void> => {
  perRequest.delete(c);
  await cacheOf(c)?.entry(seoSettingsCache).delete();
};
