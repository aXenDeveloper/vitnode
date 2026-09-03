import type { ContentSitemapChangeFrequency } from "./types";

import {
  CONTENT_SITEMAP_DEFAULT_PAGE_SIZE,
  CONTENT_SITEMAP_MAX_URLS,
} from "./const";

/** One line of a sitemap, as the delivery service produces it. */
export interface ContentSitemapEntry {
  /** One of the seven `changefreq` values, or `null` to omit the element. */
  changeFrequency: ContentSitemapChangeFrequency | null;
  itemId: number;

  lastModified: Date;
  /** The language this URL is in, or `null` for a nonlocalized content type. */
  locale: null | string;
  /** Relative, always. An origin is applied at serialization time. */
  path: string;
  priority: null | number;
}

export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const absolute = (origin: string, path: string): null | string => {
  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
};

/** `priority` at the one precision the protocol illustrates, without a float tail. */
const formatPriority = (priority: number): string => priority.toFixed(1);

export const contentSitemapXml = ({
  alternates,
  entries,
  origin,
}: {
  /**
   * The alternates of each entry, keyed by `itemId`. Omit it and no `xhtml:link`
   * element is emitted at all, which is a valid sitemap and the right default.
   */
  alternates?: ReadonlyMap<number, readonly { locale: string; path: string }[]>;
  entries: readonly ContentSitemapEntry[];
  origin: string;
}): string => {
  const withAlternates = alternates !== undefined && alternates.size > 0;
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    withAlternates
      ? '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
      : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const entry of entries) {
    const loc = absolute(origin, entry.path);
    if (loc === null) continue;

    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(loc)}</loc>`);
    lines.push(
      `    <lastmod>${escapeXml(entry.lastModified.toISOString())}</lastmod>`,
    );
    if (entry.changeFrequency !== null) {
      lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
    }
    if (entry.priority !== null) {
      lines.push(`    <priority>${formatPriority(entry.priority)}</priority>`);
    }

    for (const alternate of alternates?.get(entry.itemId) ?? []) {
      const href = absolute(origin, alternate.path);
      if (href === null) continue;

      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.locale)}" href="${escapeXml(href)}" />`,
      );
    }

    lines.push("  </url>");
  }

  lines.push("</urlset>");

  return `${lines.join("\n")}\n`;
};

/** One file in a sitemap index. */
export interface ContentSitemapIndexEntry {
  lastModified?: Date;
  /** Relative or absolute; a relative one is resolved against the origin. */
  path: string;
}

/**
 * A `<sitemapindex>` document.
 *
 * What a site serves at `/sitemap.xml` once one file is not enough. It is a
 * separate function from {@link contentSitemapXml} because it is a separate
 * document type with a separate root element - and because an index whose entries
 * were `<url>` elements is the single most common way to publish a sitemap no
 * crawler reads.
 */
export const contentSitemapIndexXml = ({
  entries,
  origin,
}: {
  entries: readonly ContentSitemapIndexEntry[];
  origin: string;
}): string => {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const entry of entries) {
    const loc = absolute(origin, entry.path);
    if (loc === null) continue;

    lines.push("  <sitemap>");
    lines.push(`    <loc>${escapeXml(loc)}</loc>`);
    if (entry.lastModified !== undefined) {
      lines.push(
        `    <lastmod>${escapeXml(entry.lastModified.toISOString())}</lastmod>`,
      );
    }
    lines.push("  </sitemap>");
  }

  lines.push("</sitemapindex>");

  return `${lines.join("\n")}\n`;
};

/**
 * How many files a given number of URLs needs, and how big each one is.
 *
 * One `1` for an empty content type rather than `0`: a site that serves
 * `/sitemaps/blog.article-1.xml` should get an empty but valid document there
 * rather than a 404, because an index that lists a file which does not exist is a
 * broken index and a content type with nothing published today will have
 * something tomorrow.
 *
 * `size` is clamped to the protocol's 50,000-URL ceiling, so a caller cannot ask
 * for one enormous invalid file by passing a bigger page size.
 */
export const contentSitemapChunks = ({
  size = CONTENT_SITEMAP_DEFAULT_PAGE_SIZE,
  total,
}: {
  size?: number;
  total: number;
}): { pages: number; size: number } => {
  const clamped = Math.max(
    1,
    Math.min(Math.floor(size), CONTENT_SITEMAP_MAX_URLS),
  );

  return {
    pages: Math.max(1, Math.ceil(Math.max(0, total) / clamped)),
    size: clamped,
  };
};
