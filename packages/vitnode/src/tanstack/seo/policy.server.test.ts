import { describe, expect, it } from "vitest";

import {
  normalizeSeoSitemapPath,
  resolveSeoPolicy,
  SeoConfigError,
} from "./policy.server";

const LOCALES = ["en", "pl"];

describe("resolveSeoPolicy", () => {
  it("is null when `seo` is left out, so the feature stays off", () => {
    expect(resolveSeoPolicy(undefined)).toBeNull();
  });

  it.each<[string, unknown]>([
    ["not an object", "yes"],
    ["missing indexing", {}],
    ["string indexing", { indexing: "true" }],
    ["unknown top-level key", { indexing: true, robots: true }],
    ["unknown sitemap key", { indexing: true, sitemap: { files: [] } }],
    [
      "non-boolean sitemap.enabled",
      { indexing: true, sitemap: { enabled: 1 } },
    ],
    ["non-array sitemap.paths", { indexing: true, sitemap: { paths: "/" } }],
    ["unknown crawler vendor", { crawlers: { bing: true }, indexing: true }],
    [
      "unknown crawler use",
      { crawlers: { openai: { ads: true } }, indexing: true },
    ],
    [
      "non-boolean crawler",
      { crawlers: { anthropic: { search: "no" } }, indexing: true },
    ],
    [
      "non-boolean googleExtended",
      { crawlers: { googleExtended: null }, indexing: true },
    ],
  ])("throws SeoConfigError for %s", (_, value) => {
    expect(() => resolveSeoPolicy(value)).toThrow(SeoConfigError);
  });

  it.each<[string, unknown, boolean]>([
    ["indexing on, sitemap left out", { indexing: true }, true],
    ["indexing off, sitemap left out", { indexing: false }, false],
    [
      "indexing on, sitemap off",
      { indexing: true, sitemap: { enabled: false } },
      false,
    ],
    [
      "indexing off forces the sitemap off",
      { indexing: false, sitemap: { enabled: true } },
      false,
    ],
    [
      "indexing on, sitemap object without enabled",
      { indexing: true, sitemap: {} },
      true,
    ],
  ])("%s → sitemap.enabled %s", (_, value, enabled) => {
    expect(resolveSeoPolicy(value)?.sitemap.enabled).toBe(enabled);
  });

  it("normalizes and deduplicates sitemap paths in declaration order", () => {
    expect(
      resolveSeoPolicy(
        {
          indexing: true,
          sitemap: { paths: ["/about/", "/", "/about", "/plugins"] },
        },
        { locales: LOCALES },
      )?.sitemap.paths,
    ).toEqual(["/about", "/", "/plugins"]);
  });

  it("rejects a sitemap path that starts with a configured locale", () => {
    expect(() =>
      resolveSeoPolicy(
        { indexing: true, sitemap: { paths: ["/pl/about"] } },
        { locales: LOCALES },
      ),
    ).toThrow(SeoConfigError);
  });
});

describe("normalizeSeoSitemapPath", () => {
  it.each<[string, string]>([
    ["/", "/"],
    ["/about", "/about"],
    ["/about/", "/about"],
    ["/docs/dev", "/docs/dev"],
    ["/administrator", "/administrator"],
    ["/english", "/english"],
  ])("%j → %j", (value, expected) => {
    expect(normalizeSeoSitemapPath(value, LOCALES)).toBe(expected);
  });

  it.each<[string, unknown]>([
    ["non-string", 42],
    ["empty string", ""],
    ["relative path", "about"],
    ["protocol-relative URL", "//evil.com/about"],
    ["absolute URL", "https://example.com/about"],
    ["empty segment", "/docs//dev"],
    ["query", "/search?q=x"],
    ["hash", "/about#team"],
    ["whitespace", "/about us"],
    ["backslash", "/about\\team"],
    ["dot segment", "/docs/./dev"],
    ["parent segment", "/docs/../admin"],
    ["/admin", "/admin"],
    ["/admin subpath", "/admin/core/users"],
    ["/api subpath", "/API/users"],
    ["locale prefix", "/pl"],
    ["locale-prefixed path", "/en/about"],
  ])("rejects %s", (_, value) => {
    expect(() => normalizeSeoSitemapPath(value, LOCALES)).toThrow(
      SeoConfigError,
    );
  });
});
