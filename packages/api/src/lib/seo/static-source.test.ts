import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import type { LocaleRoutingConfig } from "@/lib/i18n/locale-routing";

import { createLocaleRouting } from "@/lib/i18n/locale-routing";

import { staticSitemapEntries, staticSitemapSource } from "./static-source";

const contextWith = (config: Partial<LocaleRoutingConfig> = {}): Context => {
  const localeRouting = createLocaleRouting({
    defaultLocale: "en",
    locales: ["en", "pl"],
    ...config,
  });

  return {
    get: (key: string) =>
      key === "core" ? { i18n: { localeRouting } } : undefined,
  } as unknown as Context;
};

describe("staticSitemapEntries", () => {
  it("lists a page once per language, each with every language plus x-default", () => {
    const alternates = [
      { href: "/blog", hreflang: "en" },
      { href: "/pl/blog", hreflang: "pl" },
      { href: "/blog", hreflang: "x-default" },
    ];

    expect(
      staticSitemapEntries(contextWith(), [
        { changeFrequency: "daily", path: "/blog", priority: 0.8 },
      ]),
    ).toStrictEqual([
      { alternates, changeFrequency: "daily", loc: "/blog", priority: 0.8 },
      { alternates, changeFrequency: "daily", loc: "/pl/blog", priority: 0.8 },
    ]);
  });

  it("lists a URL once, without alternates, on a single-language site", () => {
    expect(
      staticSitemapEntries(
        contextWith({ locales: ["en"], localePrefix: "never" }),
        ["/", "/"],
      ),
    ).toStrictEqual([{ changeFrequency: null, loc: "/", priority: null }]);
  });

  it("writes absolute URLs for languages on their own domain", () => {
    const entries = staticSitemapEntries(
      contextWith({
        domains: [
          { defaultLocale: "en", origin: "https://example.com" },
          { defaultLocale: "pl", origin: "https://example.pl" },
        ],
        localePrefix: "never",
      }),
      ["/"],
    );

    expect(entries.map(entry => entry.loc)).toStrictEqual([
      "https://example.com/",
      "https://example.pl/",
    ]);
    expect(entries[0].alternates?.at(-1)).toStrictEqual({
      href: "https://example.com/",
      hreflang: "x-default",
    });
  });
});

describe("staticSitemapSource", () => {
  it("counts and pages the localized entries", async () => {
    const c = contextWith();
    const source = staticSitemapSource({
      id: "landing",
      label: "Landing",
      paths: c2 => (c2 === c ? ["/", "/pricing"] : []),
    });

    expect(await source.count(c)).toBe(4);
    expect(
      (await source.getEntries(c, { limit: 2, offset: 1 })).map(
        entry => entry.loc,
      ),
    ).toStrictEqual(["/pl", "/pricing"]);
  });
});
