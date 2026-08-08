import { describe, expect, it } from "vitest";

import type { ContentSitemapEntry } from "./sitemap";

import {
  contentSitemapChunks,
  contentSitemapIndexXml,
  contentSitemapXml,
  escapeXml,
} from "./sitemap";

/**
 * Sitemap serialization, without a database.
 *
 * A sitemap is a document other people's parsers read, so the assertions here are
 * mostly about bytes: valid XML, correct escaping, the elements the protocol
 * defines and deterministic output. A malformed `<loc>` is not a cosmetic problem -
 * a crawler may reject the whole file.
 */

const entry = (
  overrides: Partial<ContentSitemapEntry> = {},
): ContentSitemapEntry => ({
  changeFrequency: "weekly",
  itemId: 1,
  lastModified: new Date("2026-01-02T03:04:05.000Z"),
  locale: null,
  path: "/articles/my-article",
  priority: 0.7,
  ...overrides,
});

describe("escapeXml", () => {
  it("escapes the five predefined entities", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
  });

  it("escapes the ampersand first, so nothing is double-escaped", () => {
    // `&` after `<` would turn the `&lt;` this produced into `&amp;lt;`.
    expect(escapeXml("<a & b>")).toBe("&lt;a &amp; b&gt;");
  });
});

describe("contentSitemapXml", () => {
  it("emits a valid urlset with every configured element", () => {
    const xml = contentSitemapXml({
      entries: [entry()],
      origin: "https://example.com",
    });

    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url>",
        "    <loc>https://example.com/articles/my-article</loc>",
        "    <lastmod>2026-01-02T03:04:05.000Z</lastmod>",
        "    <changefreq>weekly</changefreq>",
        "    <priority>0.7</priority>",
        "  </url>",
        "</urlset>",
        "",
      ].join("\n"),
    );
  });

  it("omits changefreq and priority when the content type set none", () => {
    const xml = contentSitemapXml({
      entries: [entry({ changeFrequency: null, priority: null })],
      origin: "https://example.com",
    });

    expect(xml).not.toContain("changefreq");
    expect(xml).not.toContain("priority");
    expect(xml).toContain("<loc>https://example.com/articles/my-article</loc>");
  });

  it("drops an entry whose path will not resolve rather than emitting a bad loc", () => {
    const xml = contentSitemapXml({
      entries: [entry(), entry({ itemId: 2, path: "http://" })],
      origin: "https://example.com",
    });

    expect(xml.match(/<url>/g)).toHaveLength(1);
  });

  it("declares the xhtml namespace only when alternates are supplied", () => {
    const without = contentSitemapXml({
      entries: [entry()],
      origin: "https://example.com",
    });
    expect(without).not.toContain("xmlns:xhtml");

    const withAlternates = contentSitemapXml({
      alternates: new Map([
        [
          1,
          [
            { locale: "en", path: "/en/articles/my-article" },
            { locale: "pl", path: "/pl/articles/moj-artykul" },
          ],
        ],
      ]),
      entries: [entry({ locale: "en", path: "/en/articles/my-article" })],
      origin: "https://example.com",
    });

    expect(withAlternates).toContain(
      'xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    );
    // Every alternate of a group is repeated inside each `<url>` - the rule
    // implementations get wrong.
    expect(withAlternates).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/articles/my-article" />',
    );
    expect(withAlternates).toContain(
      '<xhtml:link rel="alternate" hreflang="pl" href="https://example.com/pl/articles/moj-artykul" />',
    );
  });

  it("is deterministic, so two processes produce identical bytes", () => {
    const entries = [entry(), entry({ itemId: 2, path: "/articles/second" })];
    const first = contentSitemapXml({ entries, origin: "https://example.com" });
    const second = contentSitemapXml({
      entries,
      origin: "https://example.com",
    });

    expect(first).toBe(second);
  });

  it("emits an empty but valid document for no entries", () => {
    expect(
      contentSitemapXml({ entries: [], origin: "https://example.com" }),
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "</urlset>",
        "",
      ].join("\n"),
    );
  });
});

describe("contentSitemapIndexXml", () => {
  it("emits a sitemapindex, not a urlset", () => {
    const xml = contentSitemapIndexXml({
      entries: [
        {
          lastModified: new Date("2026-01-02T03:04:05.000Z"),
          path: "/sitemaps/blog.article-1.xml",
        },
        { path: "/sitemaps/blog.article-2.xml" },
      ],
      origin: "https://example.com",
    });

    expect(xml).toContain("<sitemapindex");
    expect(xml).not.toContain("<urlset");
    expect(xml).toContain(
      "<loc>https://example.com/sitemaps/blog.article-1.xml</loc>",
    );
    expect(xml).toContain("<lastmod>2026-01-02T03:04:05.000Z</lastmod>");
    // The second entry has no timestamp, so it carries no `lastmod` element.
    expect(xml.match(/<lastmod>/g)).toHaveLength(1);
  });
});

describe("contentSitemapChunks", () => {
  it("is one page for an empty content type, not zero", () => {
    // An index that lists a file which does not exist is a broken index, and a
    // content type with nothing published today will have something tomorrow.
    expect(contentSitemapChunks({ total: 0 })).toStrictEqual({
      pages: 1,
      size: 1_000,
    });
  });

  it("divides by the page size and rounds up", () => {
    expect(contentSitemapChunks({ size: 100, total: 250 })).toStrictEqual({
      pages: 3,
      size: 100,
    });
  });

  it("clamps the page size to the protocol ceiling", () => {
    expect(
      contentSitemapChunks({ size: 1_000_000, total: 60_000 }),
    ).toStrictEqual({ pages: 2, size: 50_000 });
  });

  it("never accepts a page size below one", () => {
    expect(contentSitemapChunks({ size: 0, total: 3 })).toStrictEqual({
      pages: 3,
      size: 1,
    });
  });
});
