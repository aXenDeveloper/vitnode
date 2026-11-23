import type { SitemapSource } from "./sitemap";
import type { SitemapStaticPath } from "./static-source";

import { DEFAULT_ROBOTS_DISALLOW } from "./robots";
import { defineSitemapSource } from "./sitemap";
import { staticSitemapSource } from "./static-source";

/** Sitemap pages and sources a plugin or the app adds. */
export interface SeoSitemapContribution {
  /** Internal paths added to core's `static` source, e.g. `/blog`. */
  paths?: readonly (SitemapStaticPath | string)[];
  /** Sources with their own sub-sitemap files. */
  sources?: readonly SitemapSource[];
}

/** `buildApiConfig({ seo })`: what the app adds to `robots.txt` and the sitemap. */
export interface SeoApiConfig {
  robots?: {
    /**
     * Paths disallowed for every crawler, on top of the private areas core
     * always lists (`/admin`, `/settings`, `/modcp`, `/notifications`,
     * `/files`). Localized for every language automatically.
     */
    disallow?: readonly string[];
  };
  /**
   * Extra pages and sources. The `static` source lists `/` plus every path
   * given here and by plugins, in every language.
   */
  sitemap?: SeoSitemapContribution;
}

/** The SEO registrations of one installation, resolved at boot. */
export interface ResolvedSeoConfig {
  /** Unlocalized paths disallowed for every crawler. */
  robotsDisallow: string[];
  /** Declared sources, in index order: static, content types, plugins, app. */
  sitemapSources: SitemapSource[];
}

/** Id and label of core's own source of fixed pages. */
export const STATIC_SITEMAP_SOURCE = {
  id: "static",
  label: "admin.system.seo.sources.static",
} as const;

const pathOf = (path: SitemapStaticPath | string) =>
  typeof path === "string" ? path : path.path;

/**
 * Collects every sitemap source and robots path. Server-only.
 *
 * @throws At startup, when a source id is invalid or two sources share one.
 */
export const resolveSeoConfig = ({
  config,
  contentSources,
  plugins,
}: {
  config?: SeoApiConfig;
  contentSources: readonly SitemapSource[];
  plugins: readonly { pluginId: string; sitemap?: SeoSitemapContribution }[];
}): ResolvedSeoConfig => {
  const byPath = new Map<string, SitemapStaticPath | string>([["/", "/"]]);
  for (const path of [
    ...plugins.flatMap(plugin => plugin.sitemap?.paths ?? []),
    ...(config?.sitemap?.paths ?? []),
  ]) {
    byPath.set(pathOf(path), path);
  }
  const paths = [...byPath.values()];

  const sources: SitemapSource[] = [
    staticSitemapSource({ ...STATIC_SITEMAP_SOURCE, paths }),
    ...contentSources,
    ...plugins.flatMap(plugin => plugin.sitemap?.sources ?? []),
    ...(config?.sitemap?.sources ?? []),
  ];
  const seen = new Set<string>();
  for (const source of sources) {
    defineSitemapSource(source);
    if (seen.has(source.id)) {
      throw new Error(
        `Two sitemap sources share the id "${source.id}". Give one of them another id.`,
      );
    }
    seen.add(source.id);
  }

  return {
    robotsDisallow: [
      ...new Set([
        ...DEFAULT_ROBOTS_DISALLOW,
        ...(config?.robots?.disallow ?? []),
      ]),
    ],
    sitemapSources: sources,
  };
};
