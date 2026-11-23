import type { Context } from "hono";

import type { ContentSitemapChangeFrequency } from "@/content/types";

import type { SitemapEntry, SitemapSource } from "./sitemap";

import { defineSitemapSource } from "./sitemap";

/** One page of the static sitemap source. */
export interface SitemapStaticPath {
  changeFrequency?: ContentSitemapChangeFrequency;
  /** The internal (unlocalized) path, e.g. `/` or `/blog`. */
  path: string;
  /** `0` to `1`. */
  priority?: number;
}

const toStaticPath = (path: SitemapStaticPath | string): SitemapStaticPath =>
  typeof path === "string" ? { path } : path;

const urlOf = (url: { origin?: string; pathname: string }): string =>
  url.origin === undefined
    ? url.pathname
    : new URL(url.pathname, url.origin).href;

/**
 * One entry per page and language, each with every language as an `hreflang`
 * alternate plus `x-default` for the default locale. Duplicate URLs (a
 * `localePrefix: "never"` site) are listed once.
 */
export const staticSitemapEntries = (
  c: Context,
  paths: readonly (SitemapStaticPath | string)[],
): SitemapEntry[] => {
  const routing = c.get("core").i18n.localeRouting;
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];

  for (const page of paths.map(toStaticPath)) {
    const localized = routing.alternatesFor(page.path).map(alternate => ({
      href: urlOf(alternate),
      hreflang: alternate.locale,
    }));
    const unique = localized.filter(
      (alternate, index) =>
        localized.findIndex(other => other.href === alternate.href) === index,
    );
    const xDefault = unique.find(
      alternate => alternate.hreflang === routing.defaultLocale,
    );
    const alternates =
      unique.length > 1
        ? [
            ...unique,
            ...(xDefault
              ? [{ href: xDefault.href, hreflang: "x-default" }]
              : []),
          ]
        : undefined;

    for (const { href } of unique) {
      if (seen.has(href)) continue;
      seen.add(href);
      entries.push({
        changeFrequency: page.changeFrequency ?? null,
        loc: href,
        priority: page.priority ?? null,
        ...(alternates ? { alternates } : {}),
      });
    }
  }

  return entries;
};

/**
 * A sitemap source for a fixed list of pages, localized for every language
 * of the site. Core's `static` source is one; plugins can make their own.
 *
 * @example
 * import { staticSitemapSource } from "@vitnode/api/lib/seo/static-source";
 *
 * staticSitemapSource({ id: "landing", label: "Landing pages", paths: ["/pricing"] });
 */
export const staticSitemapSource = ({
  id,
  label,
  paths,
}: {
  id: string;
  label: string;
  paths:
    | ((c: Context) => readonly (SitemapStaticPath | string)[])
    | readonly (SitemapStaticPath | string)[];
}): SitemapSource => {
  const entriesOf = (c: Context) =>
    staticSitemapEntries(c, typeof paths === "function" ? paths(c) : paths);

  return defineSitemapSource({
    count: async c => await Promise.resolve(entriesOf(c).length),
    getEntries: async (c, { limit, offset }) =>
      await Promise.resolve(entriesOf(c).slice(offset, offset + limit)),
    id,
    label,
  });
};
