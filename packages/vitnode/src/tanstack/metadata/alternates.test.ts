import { afterEach, describe, expect, it, vi } from "vitest";

import { createLocaleRouting } from "@/lib/i18n/locale-routing";

import { configureIntl, resetIntlRuntime } from "../i18n/runtime";
import { declaredLocaleAlternates, localeAlternateLinks } from "./alternates";
import { routeHead } from "./index";

const ROUTE_PATHS = { pl: { "/articles/:slug": "/artykuly/:slug" } };

const prefixed = createLocaleRouting({
  defaultLocale: "en",
  locales: ["en", "pl", "de"],
  routePaths: ROUTE_PATHS,
});

const onDomains = createLocaleRouting({
  defaultLocale: "en",
  domains: [
    {
      defaultLocale: "en",
      locales: ["en", "de"],
      origin: "https://vitnode.com",
    },
    { defaultLocale: "pl", origin: "https://vitnode.pl" },
  ],
  locales: ["en", "pl", "de"],
  routePaths: ROUTE_PATHS,
});

const ALTERNATES = {
  en: "/articles/hello-world",
  pl: "/articles/witaj-swiecie",
};

afterEach(() => {
  resetIntlRuntime();
  vi.unstubAllEnvs();
});

describe("localeAlternateLinks", () => {
  it("emits the canonical URL, one hreflang per locale and x-default", () => {
    expect(
      localeAlternateLinks({
        alternates: ALTERNATES,
        locale: "pl",
        localeRouting: prefixed,
        webOrigin: "https://site.example",
      }),
    ).toEqual([
      {
        href: "https://site.example/pl/artykuly/witaj-swiecie",
        rel: "canonical",
      },
      {
        href: "https://site.example/articles/hello-world",
        hrefLang: "en",
        rel: "alternate",
      },
      {
        href: "https://site.example/pl/artykuly/witaj-swiecie",
        hrefLang: "pl",
        rel: "alternate",
      },
      {
        href: "https://site.example/articles/hello-world",
        hrefLang: "x-default",
        rel: "alternate",
      },
    ]);
  });

  it("accepts public paths, such as delivery API alternates, without prefixing them twice", () => {
    const fromInternal = localeAlternateLinks({
      alternates: ALTERNATES,
      locale: "pl",
      localeRouting: prefixed,
      webOrigin: "https://site.example",
    });

    expect(
      localeAlternateLinks({
        alternates: {
          en: "/articles/hello-world",
          pl: "/pl/artykuly/witaj-swiecie",
        },
        locale: "pl",
        localeRouting: prefixed,
        webOrigin: "https://site.example",
      }),
    ).toEqual(fromInternal);
    expect(
      localeAlternateLinks({
        alternates: {
          en: "/articles/hello-world",
          pl: "/artykuly/witaj-swiecie",
        },
        locale: "pl",
        localeRouting: onDomains,
      }).find(link => link.hrefLang === "pl")?.href,
    ).toBe("https://vitnode.pl/artykuly/witaj-swiecie");
  });

  it("uses each locale's own domain when one is configured", () => {
    const links = localeAlternateLinks({
      alternates: ALTERNATES,
      locale: "en",
      localeRouting: onDomains,
      webOrigin: "https://ignored.example",
    });

    expect(links).toContainEqual({
      href: "https://vitnode.pl/artykuly/witaj-swiecie",
      hrefLang: "pl",
      rel: "alternate",
    });
    expect(links).toContainEqual({
      href: "https://vitnode.com/articles/hello-world",
      rel: "canonical",
    });
  });

  it("resolves against VITNODE_WEB_URL rather than any request host", () => {
    vi.stubEnv("VITNODE_WEB_URL", "https://web.example");

    expect(
      localeAlternateLinks({
        internalPathname: "/discover",
        locale: "en",
        locales: ["en", "de"],
        localeRouting: prefixed,
      }).map(link => link.href),
    ).toEqual([
      "https://web.example/discover",
      "https://web.example/discover",
      "https://web.example/de/discover",
      "https://web.example/discover",
    ]);
  });

  it("leaves out x-default when the default locale has no version", () => {
    const links = localeAlternateLinks({
      alternates: { pl: "/articles/witaj-swiecie" },
      locale: "pl",
      localeRouting: prefixed,
      webOrigin: "https://site.example",
    });

    expect(links.map(link => link.hrefLang ?? link.rel)).toEqual([
      "canonical",
      "pl",
    ]);
  });

  it.each([
    ["an unknown locale", { fr: "/articles/bonjour" }],
    ["a protocol-relative path", { en: "//evil.example/x" }],
    ["a backslash path", { en: "/\\evil.example/x" }],
    ["a relative path", { en: "articles/x" }],
    ["an absolute URL", { en: "https://evil.example/x" }],
  ])("drops %s", (_label, alternates) => {
    expect(
      localeAlternateLinks({
        alternates,
        locale: "en",
        localeRouting: prefixed,
        webOrigin: "https://site.example",
      }),
    ).toEqual([]);
  });
});

describe("routeHead alternates", () => {
  const METADATA = { title: "VitNode" };

  it("adds no links for a page that declares no alternates", () => {
    expect(routeHead(METADATA, { title: "Guide" })).not.toHaveProperty("links");
  });

  it("adds the links for a page that declares them", () => {
    configureIntl({
      fetchMessages: async ({ locale }) =>
        await Promise.resolve({ locale, messages: {} }),
      i18n: {
        defaultLocale: "en",
        locales: [
          { code: "en", name: "English" },
          { code: "pl", name: "Polski" },
        ],
        routePaths: ROUTE_PATHS,
      },
    });
    vi.stubEnv("VITNODE_WEB_URL", "https://web.example");

    expect(
      routeHead(METADATA, { alternates: ALTERNATES, locale: "en" }).links?.[0],
    ).toEqual({
      href: "https://web.example/articles/hello-world",
      rel: "canonical",
    });
  });
});

describe("declaredLocaleAlternates", () => {
  it("reads the deepest match that declares hreflang links", () => {
    const alternates = declaredLocaleAlternates([
      {
        links: [
          { href: "https://a.example/", hrefLang: "en", rel: "alternate" },
        ],
      },
      { links: [{ href: "/app.css", rel: "stylesheet" }] },
      {
        links: localeAlternateLinks({
          alternates: ALTERNATES,
          locale: "en",
          localeRouting: prefixed,
          webOrigin: "https://site.example",
        }),
      },
      {},
    ]);

    expect(alternates && Object.fromEntries(alternates)).toEqual({
      en: "https://site.example/articles/hello-world",
      pl: "https://site.example/pl/artykuly/witaj-swiecie",
    });
  });

  it("answers undefined when no page declares any", () => {
    expect(
      declaredLocaleAlternates([
        { links: [{ href: "/app.css", rel: "stylesheet" }] },
        { links: "nonsense" },
      ]),
    ).toBeUndefined();
  });
});
