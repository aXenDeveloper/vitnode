import type { Context } from "hono";

import type { SeoSettings } from "./settings";
import type { SitemapSource } from "./sitemap";

import { contentSitemapIndexXml } from "../../content/sitemap";
import { CONFIG } from "../config";
import { loadSiteStatus } from "../site-status.server";
import { registeredSitemapSources } from "./registry";
import { buildRobotsTxt } from "./robots";
import { loadSeoSettings } from "./settings.server";
import {
  parseSitemapFileName,
  sitemapFileName,
  sitemapPageCount,
  sitemapUrlsetXml,
} from "./sitemap";

/** The canonical site origin, without a trailing slash. */
export const seoSiteOrigin = (): string => CONFIG.web.origin;

/** The absolute URL of `/sitemap.xml`. */
export const sitemapIndexUrl = (): string =>
  new URL("/sitemap.xml", seoSiteOrigin()).href;

/**
 * Every sitemap source: the declared ones (static, content types, plugins,
 * app) and then those added with `registerSitemapSource`. Server-only.
 */
export const getSitemapSources = (c: Context): SitemapSource[] => {
  const declared = c.get("core").seo.sitemapSources;
  const ids = new Set(declared.map(source => source.id));

  return [
    ...declared,
    ...registeredSitemapSources().filter(source => !ids.has(source.id)),
  ];
};

/** The sources the settings leave switched on. */
export const enabledSitemapSources = (
  c: Context,
  settings: SeoSettings,
): SitemapSource[] => {
  const disabled = new Set(settings.sitemap.disabledSources);

  return getSitemapSources(c).filter(source => !disabled.has(source.id));
};

/** Whether `/sitemap.xml` and its files answer at all. */
export const sitemapsServed = (settings: SeoSettings): boolean =>
  settings.allowIndexing && settings.sitemap.enabled;

/**
 * Disallowed paths in every language: `/settings` and `/pl/settings`.
 * Paths on another locale domain cannot be written in this host's file, so
 * they are left out.
 */
export const robotsDisallowPaths = (c: Context): string[] => {
  const { i18n, seo } = c.get("core");
  const paths = new Set<string>();

  for (const path of seo.robotsDisallow) {
    paths.add(path);
    for (const alternate of i18n.localeRouting.alternatesFor(path)) {
      if (alternate.origin === undefined) paths.add(alternate.pathname);
    }
  }

  return [...paths];
};

/** The context the robots generator needs, for `/robots.txt` and the AdminCP preview. */
export const robotsContext = async (c: Context) => {
  const status = await loadSiteStatus(c);

  return {
    disallow: robotsDisallowPaths(c),
    offline: status.offline,
    opensAt: status.opensAt,
    sitemapUrl: sitemapIndexUrl(),
  };
};

/** The `robots.txt` body for `settings`. Server-only. */
export const renderRobotsTxt = async (
  c: Context,
  settings: SeoSettings,
): Promise<{ body: string; offline: boolean; opensAt: null | string }> => {
  const context = await robotsContext(c);

  return {
    body: buildRobotsTxt({
      allowIndexing: settings.allowIndexing,
      blockAiCrawlers: settings.blockAiCrawlers,
      customRobots: settings.customRobots,
      disallow: context.disallow,
      offline: context.offline,
      sitemapUrl: sitemapsServed(settings) ? context.sitemapUrl : null,
    }),
    offline: context.offline,
    opensAt: context.opensAt,
  };
};

/** One source's size: URLs and files. Failing sources count as empty. */
export const sitemapSourceStats = async (
  c: Context,
  source: SitemapSource,
  perFile: number,
): Promise<{ error: boolean; files: number; urls: number }> => {
  try {
    const urls = await source.count(c);

    return { error: false, files: sitemapPageCount(urls, perFile), urls };
  } catch (error) {
    await c
      .get("log")
      .error(`Sitemap source "${source.id}" failed to count: ${String(error)}`);

    return { error: true, files: 0, urls: 0 };
  }
};

/** The `<sitemapindex>` document, or `null` when sitemaps are off. Server-only. */
export const renderSitemapIndex = async (
  c: Context,
): Promise<null | string> => {
  const settings = await loadSeoSettings(c);
  if (!sitemapsServed(settings)) return null;

  const perFile = settings.sitemap.maxUrlsPerFile;
  const sources = enabledSitemapSources(c, settings);
  const files = await Promise.all(
    sources.map(async source => {
      const { files: pages } = await sitemapSourceStats(c, source, perFile);
      if (pages === 0) return [];
      const lastModified = await source.getLastModified?.(c).catch(() => null);

      return Array.from({ length: pages }, (_, index) => ({
        path: `/sitemaps/${sitemapFileName(source.id, index + 1)}`,
        ...(lastModified ? { lastModified } : {}),
      }));
    }),
  );

  return contentSitemapIndexXml({
    entries: files.flat(),
    origin: seoSiteOrigin(),
  });
};

/**
 * One `<urlset>` file, or `null` for a 404: sitemaps off, an unknown or
 * disabled source, or a page past the end. Server-only.
 */
export const renderSitemapFile = async (
  c: Context,
  fileName: string,
): Promise<null | string> => {
  const parsed = parseSitemapFileName(fileName);
  if (!parsed) return null;

  const settings = await loadSeoSettings(c);
  if (!sitemapsServed(settings)) return null;

  const source = enabledSitemapSources(c, settings).find(
    entry => entry.id === parsed.sourceId,
  );
  if (!source) return null;

  const limit = settings.sitemap.maxUrlsPerFile;
  const offset = (parsed.page - 1) * limit;
  const total = await source.count(c);
  if (offset >= total) return null;

  const entries = await source.getEntries(c, { limit, offset });

  return sitemapUrlsetXml({ entries, origin: seoSiteOrigin() });
};
