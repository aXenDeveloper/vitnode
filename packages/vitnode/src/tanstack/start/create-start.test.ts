import { describe, expect, it } from "vitest";

import { LocaleRoutingConfigError } from "@/lib/i18n/route-paths";
import { buildConfig } from "@/vitnode.config";

import { createVitNodeStart } from "./create-start";

const LOCALES = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

const configWith = (i18n: {
  domains?: { defaultLocale: string; origin: string }[];
  routePaths?: Record<string, Record<string, string>>;
}) =>
  buildConfig({
    i18n: { defaultLocale: "en", locales: LOCALES, ...i18n },
    metadata: { title: "VitNode" },
    plugins: [],
  });

describe("createVitNodeStart", () => {
  it("accepts translated route paths and language domains", () => {
    expect(() =>
      createVitNodeStart({
        config: configWith({
          domains: [
            { defaultLocale: "en", origin: "https://vitnode.com" },
            { defaultLocale: "pl", origin: "https://vitnode.pl" },
          ],
          routePaths: { pl: { "/articles/:id": "/artykuly/:id" } },
        }),
      }),
    ).not.toThrow();
  });

  it.each([
    [
      "a route translation that drops a param",
      { routePaths: { pl: { "/articles/:id": "/artykuly" } } },
    ],
    [
      "a domain with a path",
      {
        domains: [
          { defaultLocale: "en", origin: "https://vitnode.com/en" },
          { defaultLocale: "pl", origin: "https://vitnode.pl" },
        ],
      },
    ],
    [
      "a locale without a domain",
      { domains: [{ defaultLocale: "en", origin: "https://vitnode.com" }] },
    ],
  ])("refuses %s before serving a request", (_label, i18n) => {
    expect(() => createVitNodeStart({ config: configWith(i18n) })).toThrow(
      LocaleRoutingConfigError,
    );
  });
});
