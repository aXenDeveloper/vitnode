import { describe, expect, it } from "vitest";

import { CONTENT_SITEMAP_MAX_URLS } from "@/content/const";

import type { SitemapEntry, SitemapSource } from "./sitemap";

import {
  defineSitemapSource,
  parseSitemapFileName,
  sitemapPageCount,
  sitemapUrlsetXml,
} from "./sitemap";

const ORIGIN = "https://example.com";

const XHTML_NS = 'xmlns:xhtml="http://www.w3.org/1999/xhtml"';
const IMAGE_NS =
  'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';

const urlset = (...entries: SitemapEntry[]) =>
  sitemapUrlsetXml({ entries, origin: ORIGIN });

describe("parseSitemapFileName", () => {
  it.each([
    ["blog_post-1.xml", { page: 1, sourceId: "blog_post" }],
    ["static-12.xml", { page: 12, sourceId: "static" }],
    ["my-source-3.xml", { page: 3, sourceId: "my-source" }],
  ])("reads %s", (fileName, expected) => {
    expect(parseSitemapFileName(fileName)).toStrictEqual(expected);
  });

  it.each([
    ["page 0", "blog_post-0.xml"],
    ["an uppercase id", "Blog-1.xml"],
    ["path traversal", "../static-1.xml"],
    ["an encoded slash", "a%2Fb-1.xml"],
    ["no extension", "static-1"],
    ["another extension", "static-1.xml.gz"],
    ["no page", "static.xml"],
    ["a page too long to be a page", "static-1234567890.xml"],
  ])("refuses %s", (_, fileName) => {
    expect(parseSitemapFileName(fileName)).toBeNull();
  });
});

describe("sitemapPageCount", () => {
  it.each([
    [0, 100, 0],
    [1, 100, 1],
    [100, 100, 1],
    [101, 100, 2],
    [10, 0, 10],
    [10, 2.9, 5],
    [CONTENT_SITEMAP_MAX_URLS + 1, CONTENT_SITEMAP_MAX_URLS * 2, 2],
  ])("splits %i URLs at %d per file into %i files", (total, perFile, files) => {
    expect(sitemapPageCount(total, perFile)).toBe(files);
  });
});

describe("sitemapUrlsetXml", () => {
  it("declares only the sitemap namespace when no entry has alternates or images", () => {
    expect(urlset({ loc: "/a" })).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url>",
        "    <loc>https://example.com/a</loc>",
        "  </url>",
        "</urlset>",
        "",
      ].join("\n"),
    );
  });

  it.each([
    [
      "alternates",
      { alternates: [{ href: "/pl/a", hreflang: "pl" }], loc: "/a" },
      [XHTML_NS],
    ],
    ["images", { images: [{ loc: "/i.png" }], loc: "/a" }, [IMAGE_NS]],
    [
      "both",
      {
        alternates: [{ href: "/pl/a", hreflang: "pl" }],
        images: [{ loc: "/i.png" }],
        loc: "/a",
      },
      [XHTML_NS, IMAGE_NS],
    ],
  ] satisfies [string, SitemapEntry, string[]][])(
    "declares the namespaces an entry with %s needs",
    (_, entry, expected) => {
      const root = urlset({ loc: "/b" }, entry).split("\n")[1];

      expect(
        [XHTML_NS, IMAGE_NS].filter(ns => root.includes(ns)),
      ).toStrictEqual(expected);
    },
  );

  it("renders every field of an entry, resolving relative URLs against the origin", () => {
    expect(
      urlset({
        alternates: [
          { href: "/a", hreflang: "en" },
          { href: "https://example.pl/a", hreflang: "pl" },
          { href: "/a", hreflang: "x-default" },
        ],
        changeFrequency: "weekly",
        images: [{ loc: "/files/cover.png" }],
        lastModified: new Date("2026-01-02T03:04:05.000Z"),
        loc: "/a",
        priority: 0.75,
      })
        .split("\n")
        .slice(2, -3),
    ).toStrictEqual([
      "  <url>",
      "    <loc>https://example.com/a</loc>",
      "    <lastmod>2026-01-02T03:04:05.000Z</lastmod>",
      "    <changefreq>weekly</changefreq>",
      "    <priority>0.8</priority>",
      '    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/a" />',
      '    <xhtml:link rel="alternate" hreflang="pl" href="https://example.pl/a" />',
      '    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/a" />',
      "    <image:image>",
      "      <image:loc>https://example.com/files/cover.png</image:loc>",
      "    </image:image>",
    ]);
  });

  it("escapes URLs and hreflang values", () => {
    const xml = urlset({
      alternates: [{ href: "/a?x=1&y=2", hreflang: 'p"l' }],
      loc: "/a?x=1&y=<2>",
    });

    expect(xml).toContain("<loc>https://example.com/a?x=1&amp;y=%3C2%3E</loc>");
    expect(xml).toContain(
      'hreflang="p&quot;l" href="https://example.com/a?x=1&amp;y=2"',
    );
  });

  it("skips an invalid lastmod but keeps the entry", () => {
    const xml = urlset({ lastModified: new Date("nope"), loc: "/a" });

    expect(xml).toContain("<loc>https://example.com/a</loc>");
    expect(xml).not.toContain("<lastmod>");
  });

  it("skips an entry whose URL cannot be built", () => {
    expect(
      sitemapUrlsetXml({ entries: [{ loc: "/a" }], origin: "not a url" }),
    ).not.toContain("<url>");
  });

  it.each([
    [-1, "0.0"],
    [0, "0.0"],
    [0.5, "0.5"],
    [2, "1.0"],
  ])("clamps priority %d to %s", (priority, expected) => {
    expect(urlset({ loc: "/a", priority })).toContain(
      `<priority>${expected}</priority>`,
    );
  });
});

describe("defineSitemapSource", () => {
  const source = (id: string): SitemapSource => ({
    count: async () => await Promise.resolve(0),
    getEntries: async () => await Promise.resolve([]),
    id,
    label: "Source",
  });

  it("returns a source with a valid id unchanged", () => {
    const valid = source("blog_post-2");

    expect(defineSitemapSource(valid)).toBe(valid);
  });

  it.each(["", "Blog", "blog.post", "a/b", "a b"])(
    "throws for the id %j",
    id => {
      expect(() => defineSitemapSource(source(id))).toThrow(
        "Invalid sitemap source id",
      );
    },
  );
});
