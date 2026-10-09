import { describe, expect, it } from "vitest";

import { PrerenderDomainsError, prerenderRoutes } from "./prerender-routes";

const locales = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

describe("prerenderRoutes", () => {
  it("writes every path once per locale, the default locale unprefixed", () => {
    expect(
      prerenderRoutes({
        i18n: { defaultLocale: "en", locales },
        paths: ["/", "/plugins"],
      }),
    ).toEqual(["/", "/plugins", "/pl", "/pl/plugins"]);
  });

  it("uses a locale's translated route path", () => {
    expect(
      prerenderRoutes({
        i18n: {
          defaultLocale: "en",
          locales,
          routePaths: { pl: { "/discover": "/odkrywaj" } },
        },
        paths: ["/discover"],
      }),
    ).toEqual(["/discover", "/pl/odkrywaj"]);
  });

  it("prefixes the default locale too when every locale is prefixed", () => {
    expect(
      prerenderRoutes({
        i18n: { defaultLocale: "en", localePrefix: "always", locales },
        paths: ["/plugins"],
      }),
    ).toEqual(["/en/plugins", "/pl/plugins"]);
  });

  it("skips a disabled locale", () => {
    expect(
      prerenderRoutes({
        i18n: {
          defaultLocale: "en",
          locales: [locales[0], { ...locales[1], enabled: false }],
        },
        paths: ["/plugins"],
      }),
    ).toEqual(["/plugins"]);
  });

  it("lists a repeated path only once", () => {
    expect(
      prerenderRoutes({
        i18n: { defaultLocale: "en", locales: [locales[0]] },
        paths: ["/plugins", "/plugins"],
      }),
    ).toEqual(["/plugins"]);
  });

  it("refuses per-domain locales, which one file cannot answer", () => {
    expect(() =>
      prerenderRoutes({
        i18n: {
          defaultLocale: "en",
          domains: [
            { defaultLocale: "en", origin: "https://example.com" },
            { defaultLocale: "pl", origin: "https://example.pl" },
          ],
          locales,
        },
        paths: ["/"],
      }),
    ).toThrow(PrerenderDomainsError);
  });
});
