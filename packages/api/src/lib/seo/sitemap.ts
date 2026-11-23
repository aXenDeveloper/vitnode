import type { Context } from "hono";

import type { ContentSitemapChangeFrequency } from "@/content/types";

import { CONTENT_SITEMAP_MAX_URLS } from "@/content/const";
import { escapeXml } from "@/content/sitemap";

import { SITEMAP_SOURCE_ID_PATTERN } from "./settings";

/** One `<url>` of a sub-sitemap. */
export interface SitemapEntry {
  /**
   * Other languages of the same page, each with an absolute or relative
   * `href`. Include the entry's own language; add `x-default` yourself.
   */
  alternates?: readonly { href: string; hreflang: string }[];
  changeFrequency?: ContentSitemapChangeFrequency | null;
  /** Images on the page, for `<image:image>`. Absolute or relative URLs. */
  images?: readonly { loc: string }[];
  lastModified?: Date | null;
  /** Absolute URL, or a path resolved against the site origin. */
  loc: string;
  /** `0` to `1`. */
  priority?: null | number;
}

/**
 * A list of public URLs the sitemap includes, in its own sub-sitemap files
 * (`/sitemaps/{id}-{page}.xml`). Register one with `registerSitemapSource`,
 * `buildApiPlugin({ sitemapSources })` or `buildApiConfig({ seo })`. The
 * Content Engine registers one per content type with `delivery.sitemap`.
 *
 * Both functions run for anonymous crawlers: return only what a guest may
 * read, in a stable order, so page `n` always holds the same URLs.
 *
 * @example
 * import { defineSitemapSource } from "@vitnode/api/lib/seo/sitemap";
 *
 * export const docsSitemap = defineSitemapSource({
 *   id: "docs",
 *   label: "@my/plugin.sitemap.docs",
 *   count: async () => pages.length,
 *   getEntries: async (_c, { limit, offset }) =>
 *     pages.slice(offset, offset + limit).map(page => ({ loc: page.path })),
 * });
 */
export interface SitemapSource {
  /** Set by the Content Engine, so the AdminCP shows the content type's name. */
  contentType?: { id: string; pluginId: string };
  /** How many entries `getEntries` returns in total. */
  count: (c: Context) => Promise<number>;
  /** One page of entries, `offset` from the start. */
  getEntries: (
    c: Context,
    page: { limit: number; offset: number },
  ) => Promise<SitemapEntry[]>;
  /** The newest `lastmod`, for the sitemap index. Optional. */
  getLastModified?: (c: Context) => Promise<Date | null>;
  /** Unique, matching `/^[a-z0-9_-]+$/`. Becomes part of the file name. */
  id: string;
  /** An i18n key (or plain text) the AdminCP shows. */
  label: string;
}

/**
 * Checks a source's id and returns it unchanged.
 *
 * @throws When `id` does not match `/^[a-z0-9_-]+$/`.
 */
export const defineSitemapSource = <T extends SitemapSource>(source: T): T => {
  if (!SITEMAP_SOURCE_ID_PATTERN.test(source.id)) {
    throw new Error(
      `Invalid sitemap source id "${source.id}": use lowercase letters, digits, "_" and "-".`,
    );
  }

  return source;
};

/** The file name of one page of a source: `{id}-{page}.xml`, 1-indexed. */
export const sitemapFileName = (sourceId: string, page: number): string =>
  `${sourceId}-${page}.xml`;

const FILE_NAME_PATTERN = /^([a-z0-9_-]+)-(\d{1,9})\.xml$/;

/**
 * Splits `blog_post-2.xml` into `{ sourceId: "blog_post", page: 2 }`, or
 * `null` for anything else (including page `0`).
 */
export const parseSitemapFileName = (
  fileName: string,
): null | { page: number; sourceId: string } => {
  const match = FILE_NAME_PATTERN.exec(fileName);
  if (!match) return null;

  const page = Number(match[2]);
  if (!Number.isSafeInteger(page) || page < 1) return null;

  return { page, sourceId: match[1] };
};

/** Files a source needs: `0` for an empty one, so it is left out of the index. */
export const sitemapPageCount = (total: number, perFile: number): number => {
  const size = Math.max(
    1,
    Math.min(Math.floor(perFile), CONTENT_SITEMAP_MAX_URLS),
  );

  return total > 0 ? Math.ceil(total / size) : 0;
};

const absolute = (origin: string, path: string): null | string => {
  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
};

/**
 * A `<urlset>` document. The `xhtml` and `image` namespaces are declared only
 * when an entry uses them; entries whose URL cannot be built are skipped.
 */
export const sitemapUrlsetXml = ({
  entries,
  origin,
}: {
  entries: readonly SitemapEntry[];
  origin: string;
}): string => {
  const withAlternates = entries.some(entry => entry.alternates?.length);
  const withImages = entries.some(entry => entry.images?.length);
  const namespaces = [
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    ...(withAlternates ? ['xmlns:xhtml="http://www.w3.org/1999/xhtml"'] : []),
    ...(withImages
      ? ['xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"']
      : []),
  ];
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset ${namespaces.join(" ")}>`,
  ];

  for (const entry of entries) {
    const loc = absolute(origin, entry.loc);
    if (loc === null) continue;

    lines.push("  <url>", `    <loc>${escapeXml(loc)}</loc>`);
    if (entry.lastModified && !Number.isNaN(entry.lastModified.getTime())) {
      lines.push(`    <lastmod>${entry.lastModified.toISOString()}</lastmod>`);
    }
    if (entry.changeFrequency) {
      lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
    }
    if (typeof entry.priority === "number") {
      const priority = Math.min(1, Math.max(0, entry.priority));
      lines.push(`    <priority>${priority.toFixed(1)}</priority>`);
    }
    for (const alternate of entry.alternates ?? []) {
      const href = absolute(origin, alternate.href);
      if (href === null) continue;
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(href)}" />`,
      );
    }
    for (const image of entry.images ?? []) {
      const src = absolute(origin, image.loc);
      if (src === null) continue;
      lines.push(
        "    <image:image>",
        `      <image:loc>${escapeXml(src)}</image:loc>`,
        "    </image:image>",
      );
    }
    lines.push("  </url>");
  }

  lines.push("</urlset>");

  return `${lines.join("\n")}\n`;
};

/** The headers every sitemap and `robots.txt` response carries. */
export const SEO_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
