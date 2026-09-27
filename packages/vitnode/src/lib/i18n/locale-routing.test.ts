import { describe, expect, it } from "vitest";

import type { LocaleRoutingConfig } from "./locale-routing";

import { createLocaleRouting, localeRoutingFromConfig } from "./locale-routing";

const routing = (overrides: Partial<LocaleRoutingConfig> = {}) =>
  createLocaleRouting({
    defaultLocale: "en",
    locales: ["en", "pl"],
    ...overrides,
  });

const url = (href: string) => new URL(href, "https://vitnode.test");

describe("localizePathname", () => {
  const { localizePathname } = routing();

  it.each([
    ["/", "en", "/"],
    ["/discover", "en", "/discover"],
    ["/", "pl", "/pl"],
    ["/discover", "pl", "/pl/discover"],
    ["/blog/hello-world", "pl", "/pl/blog/hello-world"],
  ])("localizes %s as %s to %s", (pathname, locale, expected) => {
    expect(localizePathname(pathname, locale)).toBe(expected);
  });

  it("is idempotent, so a path that is already localized is not doubled", () => {
    expect(localizePathname("/pl/discover", "pl")).toBe("/pl/discover");
  });

  it("re-localizes a path that carries another locale", () => {
    expect(localizePathname("/pl/discover", "en")).toBe("/discover");
  });

  it("adds no prefix for a locale the app does not serve", () => {
    // A stale cookie must degrade to the unprefixed URL, not to a 404.
    expect(localizePathname("/discover", "de")).toBe("/discover");
  });
});

describe("deLocalizePathname", () => {
  const { deLocalizePathname } = routing();

  it.each([
    ["/pl", "/"],
    ["/pl/", "/"],
    ["/pl/discover", "/discover"],
    ["/discover", "/discover"],
    ["/", "/"],
  ])("de-localizes %s to %s", (pathname, expected) => {
    expect(deLocalizePathname(pathname)).toBe(expected);
  });

  it("strips the default locale too, so a stray /en still resolves", () => {
    // The canonical redirect is what removes `/en` from public URLs; this is
    // the safety net for a link that reaches the router with one anyway.
    expect(deLocalizePathname("/en/discover")).toBe("/discover");
  });

  it("leaves a first segment that is not a locale alone", () => {
    expect(deLocalizePathname("/whatever/discover")).toBe("/whatever/discover");
    expect(deLocalizePathname("/plants")).toBe("/plants");
  });
});

describe("ignored paths", () => {
  const { deLocalizePathname, localizePathname, shouldIgnoreLocalePath } =
    routing();

  it.each([
    ["/api", true],
    ["/api/foo", true],
    ["/api/foo/bar", true],
    ["/admin", true],
    ["/admin/users", true],
    ["/discover", false],
    ["/", false],
    ["/administrators", false],
    ["/apiary", false],
  ])("shouldIgnoreLocalePath(%s) === %s", (pathname, expected) => {
    expect(shouldIgnoreLocalePath(pathname)).toBe(expected);
  });

  it.each(["/admin", "/admin/users", "/api/foo"])(
    "never localizes %s",
    pathname => {
      expect(localizePathname(pathname, "pl")).toBe(pathname);
      expect(deLocalizePathname(pathname)).toBe(pathname);
    },
  );

  it("takes the ignored list from configuration", () => {
    const custom = routing({ ignoredPaths: ["/panel"] });

    expect(custom.shouldIgnoreLocalePath("/panel/users")).toBe(true);
    expect(custom.shouldIgnoreLocalePath("/admin")).toBe(false);
  });
});

describe("extractLocaleFromPath", () => {
  const { extractLocaleFromPath } = routing();

  it("reads a non-default locale prefix", () => {
    expect(extractLocaleFromPath("/pl")).toBe("pl");
    expect(extractLocaleFromPath("/pl/discover")).toBe("pl");
  });

  it("does not treat the unprefixed default locale's URL as a prefix", () => {
    expect(extractLocaleFromPath("/discover")).toBeUndefined();
    // `/en/...` is a URL to be redirected away, not the English page.
    expect(extractLocaleFromPath("/en/discover")).toBeUndefined();
  });

  it("does not treat an unknown first segment as a locale", () => {
    expect(extractLocaleFromPath("/xx/discover")).toBeUndefined();
    expect(extractLocaleFromPath("/whatever/discover")).toBeUndefined();
  });

  it("reads nothing from an ignored path", () => {
    expect(extractLocaleFromPath("/admin/users")).toBeUndefined();
  });
});

describe("redirectPathnameFor", () => {
  const { redirectPathnameFor } = routing();

  it.each([
    ["/en", "/"],
    ["/en/", "/"],
    ["/en/discover", "/discover"],
    ["/pl/admin", "/admin"],
    ["/pl/admin/users", "/admin/users"],
    ["/pl/api/foo", "/api/foo"],
    ["/en/admin", "/admin"],
  ])("redirects %s to %s", (pathname, expected) => {
    expect(redirectPathnameFor(pathname)).toBe(expected);
  });

  it.each(["/", "/discover", "/pl", "/pl/discover", "/admin", "/api/foo"])(
    "leaves the canonical URL %s alone",
    pathname => {
      expect(redirectPathnameFor(pathname)).toBeUndefined();
    },
  );

  it("leaves an unknown first segment alone, so the router can 404 it", () => {
    expect(redirectPathnameFor("/xx/discover")).toBeUndefined();
  });
});

describe("URL rewrites", () => {
  const { deLocalizeUrl, localizeUrl } = routing();

  it("keeps the search string, its order and the hash", () => {
    const input = url("/pl/search?q=foo&page=2&q=bar#results");

    const deLocalized = deLocalizeUrl(input);

    expect(deLocalized.pathname).toBe("/search");
    expect(deLocalized.search).toBe("?q=foo&page=2&q=bar");
    expect(deLocalized.hash).toBe("#results");
    expect(deLocalized.origin).toBe(input.origin);
  });

  it("round-trips a localized URL", () => {
    const input = url("/pl/search?q=foo");

    expect(localizeUrl(deLocalizeUrl(input), "pl").href).toBe(input.href);
  });

  it("does not mutate the URL it is given", () => {
    const input = url("/pl/discover");

    deLocalizeUrl(input);

    expect(input.pathname).toBe("/pl/discover");
  });

  it("returns the same object when there is nothing to change", () => {
    const input = url("/discover");

    expect(deLocalizeUrl(input)).toBe(input);
    expect(localizeUrl(input, "en")).toBe(input);
  });

  it("leaves ignored URLs untouched in both directions", () => {
    const input = url("/admin/users?tab=roles");

    expect(localizeUrl(input, "pl").href).toBe(input.href);
    expect(deLocalizeUrl(input).href).toBe(input.href);
  });
});

describe("resolveLocale", () => {
  const { resolveLocale } = routing();

  it("reads a public route's locale from the URL and nowhere else", () => {
    expect(resolveLocale("/discover", { cookieLocale: "pl" })).toBe("en");
    expect(resolveLocale("/pl/discover", { cookieLocale: "en" })).toBe("pl");
  });

  it("ignores Accept-Language on a public route", () => {
    expect(
      resolveLocale("/discover", { acceptLanguage: "pl-PL,pl;q=0.9" }),
    ).toBe("en");
  });

  it("reads an ignored route's locale from the cookie", () => {
    expect(resolveLocale("/admin", { cookieLocale: "pl" })).toBe("pl");
    expect(resolveLocale("/admin/users", { cookieLocale: "pl" })).toBe("pl");
  });

  it("falls back to Accept-Language, then to the default, on an ignored route", () => {
    expect(resolveLocale("/admin", { acceptLanguage: "pl-PL,pl;q=0.9" })).toBe(
      "pl",
    );
    expect(resolveLocale("/admin")).toBe("en");
  });

  it("ignores a cookie naming a locale the app does not serve", () => {
    expect(resolveLocale("/admin", { cookieLocale: "de" })).toBe("en");
  });
});

describe("SEO helpers", () => {
  const { alternatePathnames, canonicalPathname } = routing();

  it("names one canonical URL per locale", () => {
    expect(canonicalPathname("/pl/discover", "pl")).toBe("/pl/discover");
    expect(canonicalPathname("/pl/discover", "en")).toBe("/discover");
  });

  it("lists every locale's URL for a page", () => {
    expect(alternatePathnames("/pl/discover")).toEqual([
      { locale: "en", pathname: "/discover" },
      { locale: "pl", pathname: "/pl/discover" },
    ]);
  });
});

describe('localePrefix: "always"', () => {
  const { extractLocaleFromPath, localizePathname, redirectPathnameFor } =
    routing({ localePrefix: "always" });

  it("prefixes the default locale too", () => {
    expect(localizePathname("/discover", "en")).toBe("/en/discover");
    expect(extractLocaleFromPath("/en/discover")).toBe("en");
  });

  it("redirects an unprefixed URL to the default locale's", () => {
    expect(redirectPathnameFor("/discover")).toBe("/en/discover");
    expect(redirectPathnameFor("/en/discover")).toBeUndefined();
  });
});

describe('localePrefix: "never"', () => {
  const neverRouting = () =>
    routing({
      domains: [
        { defaultLocale: "en", origin: "https://vitnode.com" },
        { defaultLocale: "pl", origin: "https://vitnode.pl" },
      ],
      localePrefix: "never",
    });

  it("writes no prefix and reads none", () => {
    const { extractLocaleFromPath, localizePathname } = neverRouting();

    expect(localizePathname("/discover", "pl", { host: "vitnode.pl" })).toBe(
      "/discover",
    );
    expect(extractLocaleFromPath("/pl/discover")).toBeUndefined();
  });

  it("leaves a path that looks like a locale prefix alone - it is a route", () => {
    const { redirectPathnameFor } = neverRouting();

    expect(
      redirectPathnameFor("/pl/discover", { host: "vitnode.com" }),
    ).toBeUndefined();
  });

  it("reads a public page's locale from the host, never from the cookie", () => {
    const { resolveLocale } = neverRouting();

    expect(
      resolveLocale("/discover", { cookieLocale: "en", host: "vitnode.pl" }),
    ).toBe("pl");
    expect(
      resolveLocale("/discover", { cookieLocale: "pl", host: "vitnode.com" }),
    ).toBe("en");
  });

  it("refuses several locales sharing one host, because one URL would serve both", () => {
    expect(() => routing({ localePrefix: "never" })).toThrow(
      expect.objectContaining({ code: "ambiguous-never-prefix" }),
    );
  });

  it("allows a single-locale app without domains", () => {
    const { localizePathname } = routing({
      locales: ["en"],
      localePrefix: "never",
    });

    expect(localizePathname("/discover", "en")).toBe("/discover");
  });
});

describe("localeRoutingFromConfig", () => {
  it("derives the locale list from an app's i18n block", () => {
    const { isSupportedLocale, locales } = localeRoutingFromConfig({
      defaultLocale: "en",
      locales: [
        { code: "en", name: "English" },
        { code: "pl", name: "Polski" },
      ],
    });

    expect(locales).toEqual(["en", "pl"]);
    expect(isSupportedLocale("pl")).toBe(true);
    expect(isSupportedLocale("de")).toBe(false);
  });

  it("drops a locale the app has switched off", () => {
    const { extractLocaleFromPath, locales } = localeRoutingFromConfig({
      defaultLocale: "en",
      locales: [
        { code: "en", name: "English" },
        { code: "pl", enabled: false, name: "Polski" },
      ],
    });

    expect(locales).toEqual(["en"]);
    expect(extractLocaleFromPath("/pl/discover")).toBeUndefined();
  });

  it("ignores /admin and /api unless told otherwise", () => {
    const { shouldIgnoreLocalePath } = localeRoutingFromConfig({
      defaultLocale: "en",
      locales: [{ code: "en", name: "English" }],
    });

    expect(shouldIgnoreLocalePath("/admin/users")).toBe(true);
    expect(shouldIgnoreLocalePath("/api/foo")).toBe(true);
  });
});

describe("translated route paths", () => {
  const translated = (
    localePrefix: LocaleRoutingConfig["localePrefix"] = "as-needed",
  ) =>
    routing({
      localePrefix,
      routePaths: { pl: { "/articles/:id": "/artykuly/:id" } },
    });

  it("maps a public URL to the English route and back", () => {
    const { localizePathname, resolvePublicPathname } = translated();

    expect(resolvePublicPathname("/pl/artykuly/42")).toEqual({
      internalPathname: "/articles/42",
      locale: "pl",
      source: "prefix",
    });
    expect(localizePathname("/articles/42", "pl")).toBe("/pl/artykuly/42");
    expect(localizePathname("/articles/42", "en")).toBe("/articles/42");
  });

  it("stays idempotent for an already-localized path", () => {
    const { localizePathname } = translated();

    expect(localizePathname("/pl/artykuly/42", "pl")).toBe("/pl/artykuly/42");
    expect(localizePathname("/pl/artykuly/42", "en")).toBe("/articles/42");
  });

  it("falls back to the English spelling for an untranslated route", () => {
    expect(translated().localizePathname("/discover", "pl")).toBe(
      "/pl/discover",
    );
  });

  it("redirects an old English-spelled link to the translation, and never loops", () => {
    const { redirectUrlFor } = translated();

    expect(redirectUrlFor(url("/pl/articles/42?ref=x#top"))?.href).toBe(
      "https://vitnode.test/pl/artykuly/42?ref=x#top",
    );
    expect(redirectUrlFor(url("/pl/artykuly/42"))).toBeUndefined();
    expect(redirectUrlFor(url("/articles/42"))).toBeUndefined();
  });

  it('keeps prefix mode "always" working with translations', () => {
    const { localizePathname, redirectPathnameFor } = translated("always");

    expect(localizePathname("/articles/42", "en")).toBe("/en/articles/42");
    expect(localizePathname("/articles/42", "pl")).toBe("/pl/artykuly/42");
    expect(redirectPathnameFor("/pl/articles/42")).toBe("/pl/artykuly/42");
  });

  it("never translates admin or API paths", () => {
    const { localizePathname, resolvePublicPathname } = translated();

    expect(localizePathname("/admin/articles/42", "pl")).toBe(
      "/admin/articles/42",
    );
    expect(resolvePublicPathname("/api/articles/42").internalPathname).toBe(
      "/api/articles/42",
    );
  });

  it("lists every locale's URL for hreflang", () => {
    expect(translated().alternatesFor("/articles/42")).toEqual([
      { locale: "en", pathname: "/articles/42" },
      { locale: "pl", pathname: "/pl/artykuly/42" },
    ]);
  });
});

describe("language domains", () => {
  const withDomains = (
    localePrefix: LocaleRoutingConfig["localePrefix"] = "as-needed",
  ) =>
    routing({
      domains: [
        { defaultLocale: "en", origin: "https://vitnode.com" },
        { defaultLocale: "pl", origin: "https://vitnode.pl" },
      ],
      localePrefix,
      routePaths: { pl: { "/articles/:id": "/artykuly/:id" } },
    });

  it("lets the domain pick the locale over a cookie that disagrees", () => {
    const { resolvePublicPathname } = withDomains();

    expect(
      resolvePublicPathname("/artykuly/42", {
        acceptLanguage: "en",
        cookieLocale: "en",
        host: "vitnode.pl",
      }),
    ).toEqual({
      internalPathname: "/articles/42",
      locale: "pl",
      source: "domain",
    });
  });

  it("ignores a host nobody configured", () => {
    const { resolveLocale } = withDomains();

    expect(
      resolveLocale("/discover", { cookieLocale: "pl", host: "evil.example" }),
    ).toBe("en");
    expect(resolveLocale("/discover", { host: "vitnode.pl/evil" })).toBe("en");
  });

  it("links to another language on its own origin", () => {
    const { publicUrlFor } = withDomains("never");

    expect(publicUrlFor("/articles/42", "pl", { host: "vitnode.com" })).toEqual(
      {
        origin: "https://vitnode.pl",
        pathname: "/artykuly/42",
      },
    );
    expect(publicUrlFor("/articles/42", "pl", { host: "vitnode.pl" })).toEqual({
      pathname: "/artykuly/42",
    });
  });

  it("redirects a prefixed URL to the language's own domain", () => {
    const { redirectUrlFor } = withDomains();

    expect(
      redirectUrlFor(url("https://vitnode.com/pl/artykuly/42?q=1"), {
        host: "vitnode.com",
      })?.href,
    ).toBe("https://vitnode.pl/artykuly/42?q=1");
    expect(
      redirectUrlFor(url("https://vitnode.pl/artykuly/42"), {
        host: "vitnode.pl",
      }),
    ).toBeUndefined();
  });

  it("keeps every language local on an unconfigured host in a prefix mode", () => {
    const { publicUrlFor } = withDomains();

    expect(
      publicUrlFor("/articles/42", "pl", { host: "localhost:3000" }),
    ).toEqual({
      pathname: "/pl/artykuly/42",
    });
  });

  it("puts canonical URLs on each language's configured origin", () => {
    expect(withDomains().alternatesFor("/articles/42")).toEqual([
      { locale: "en", origin: "https://vitnode.com", pathname: "/articles/42" },
      { locale: "pl", origin: "https://vitnode.pl", pathname: "/artykuly/42" },
    ]);
  });

  it("reads admin's locale from the cookie, then the domain default", () => {
    const { resolveLocale } = withDomains();

    expect(
      resolveLocale("/admin", { cookieLocale: "en", host: "vitnode.pl" }),
    ).toBe("en");
    expect(resolveLocale("/admin", { host: "vitnode.pl" })).toBe("pl");
  });
});
