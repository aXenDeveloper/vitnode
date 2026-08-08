import type { ContentSitemapChangeFrequency } from "./types";

import {
  CONTENT_SITEMAP_DEFAULT_PAGE_SIZE,
  CONTENT_SITEMAP_MAX_URLS,
} from "./const";

/**
 * Sitemap serialization, and nothing else.
 *
 * Deliberately separate from the queries that produce the entries: "which URLs
 * are public right now" is a keyset scan over two tables, and "what does a
 * sitemap file look like" is a string. Folding them into one function would make
 * the XML untestable without a database and the pagination untestable without
 * parsing XML - so the delivery service owns the first and this module owns the
 * second.
 *
 * Client-safe and pure. No Drizzle, no Hono, no `next/*`.
 */

/** One line of a sitemap, as the delivery service produces it. */
export interface ContentSitemapEntry {
  /** One of the seven `changefreq` values, or `null` to omit the element. */
  changeFrequency: ContentSitemapChangeFrequency | null;
  itemId: number;
  /**
   * When the representation at this URL last changed.
   *
   * For a localized entry that is `max(base.updatedAt, translation.updatedAt)`,
   * because both halves are rendered into the page: a shared field moving changes
   * every language's document even though no translation row was touched.
   */
  lastModified: Date;
  /** The language this URL is in, or `null` for a nonlocalized content type. */
  locale: null | string;
  /** Relative, always. An origin is applied at serialization time. */
  path: string;
  priority: null | number;
}

/**
 * XML's five predefined entities, escaped in the one order that is correct.
 *
 * `&` **first**: escaping it after `<` would turn the `&lt;` this function just
 * produced into `&amp;lt;`. A slug is percent-encoded by the path builder so this
 * is rarely load-bearing, but a sitemap is a document other people's parsers read,
 * and "rarely" is not a guarantee.
 */
export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/**
 * A path turned into the absolute URL a sitemap has to carry.
 *
 * The protocol requires absolute URLs, which is the one place delivery cannot
 * stay origin-agnostic - so the origin is a required argument here rather than an
 * option. A path that will not resolve against it comes back `null` and the entry
 * is dropped: a sitemap with one malformed `<loc>` is a sitemap a crawler may
 * reject whole.
 */
const absolute = (origin: string, path: string): null | string => {
  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
};

/** `priority` at the one precision the protocol illustrates, without a float tail. */
const formatPriority = (priority: number): string => priority.toFixed(1);

/**
 * A `<urlset>` document for one page of entries.
 *
 * `alternates` are opt-in and, when present, emitted as `xhtml:link` elements -
 * the form the sitemap extension for `hreflang` actually defines, with the
 * namespace declared on the root element and every alternate of a group repeated
 * inside **each** of its `<url>` entries. That last rule is the one implementations
 * get wrong, and it is why alternates are supplied per entry rather than derived:
 * the caller has already resolved which translations are published, and this
 * function does not go looking.
 *
 * Every entry is emitted in the order it was given, so two processes serializing
 * the same page produce byte-identical documents.
 */
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
