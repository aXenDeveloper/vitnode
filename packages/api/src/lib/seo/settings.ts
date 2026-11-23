import { z } from "zod";

/** Limits of the SEO settings. Browser-safe. */
export const SEO_SETTINGS_LIMITS = {
  /** Longest custom `robots.txt` block, in characters. */
  customRobotsMaxLength: 10_000,
  /** The sitemap protocol's ceiling for one file. */
  sitemapMaxUrlsMax: 50_000,
  sitemapMaxUrlsMin: 100,
} as const;

/** A sitemap source id: lowercase letters, digits, `_` and `-`. */
export const SITEMAP_SOURCE_ID_PATTERN = /^[a-z0-9_-]+$/;

/** Crawling and indexing settings, as stored and served. Browser-safe. */
export const zodSeoSettings = z.object({
  /** `false` turns the whole site into `Disallow: /` and hides every sitemap. */
  allowIndexing: z.boolean(),
  /** Adds a `Disallow: /` group for the known AI training crawlers. */
  blockAiCrawlers: z.boolean(),
  /** Extra `robots.txt` lines, appended as written. */
  customRobots: z.string().max(SEO_SETTINGS_LIMITS.customRobotsMaxLength),
  sitemap: z.object({
    /** Source ids switched off in the AdminCP. */
    disabledSources: z.array(z.string().regex(SITEMAP_SOURCE_ID_PATTERN)),
    enabled: z.boolean(),
    /** URLs per sub-sitemap file. */
    maxUrlsPerFile: z
      .number()
      .int()
      .min(SEO_SETTINGS_LIMITS.sitemapMaxUrlsMin)
      .max(SEO_SETTINGS_LIMITS.sitemapMaxUrlsMax),
  }),
});

export type SeoSettings = z.output<typeof zodSeoSettings>;

/** What a site without a saved row runs with. */
export const SEO_SETTINGS_DEFAULTS: SeoSettings = {
  allowIndexing: true,
  blockAiCrawlers: false,
  customRobots: "",
  sitemap: { disabledSources: [], enabled: true, maxUrlsPerFile: 10_000 },
};

/**
 * What the AdminCP sends to change the SEO settings: any subset of the
 * fields; the rest keep their saved values. Browser-safe.
 */
export const zodSeoSettingsUpdate = z.object({
  allowIndexing: z.boolean().optional(),
  blockAiCrawlers: z.boolean().optional(),
  customRobots: zodSeoSettings.shape.customRobots.optional(),
  sitemap: zodSeoSettings.shape.sitemap.partial().optional(),
});

export type SeoSettingsUpdate = z.input<typeof zodSeoSettingsUpdate>;

/** `settings` with `update` applied. Browser-safe. */
export const mergeSeoSettings = (
  settings: SeoSettings,
  update: SeoSettingsUpdate,
): SeoSettings => ({
  allowIndexing: update.allowIndexing ?? settings.allowIndexing,
  blockAiCrawlers: update.blockAiCrawlers ?? settings.blockAiCrawlers,
  customRobots: update.customRobots ?? settings.customRobots,
  sitemap: {
    disabledSources: [
      ...new Set(
        update.sitemap?.disabledSources ?? settings.sitemap.disabledSources,
      ),
    ].sort(),
    enabled: update.sitemap?.enabled ?? settings.sitemap.enabled,
    maxUrlsPerFile:
      update.sitemap?.maxUrlsPerFile ?? settings.sitemap.maxUrlsPerFile,
  },
});

/** The page-cache tag of everything that read the SEO settings. */
export const SEO_SETTINGS_PAGE_CACHE_TAG = "core:seo-settings";
