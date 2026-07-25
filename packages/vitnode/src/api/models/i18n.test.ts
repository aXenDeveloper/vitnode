import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import { I18nModel } from "./i18n";

const makeCtx = ({
  acceptLanguage,
  userLanguage,
}: {
  acceptLanguage?: string;
  userLanguage?: string;
} = {}): Context => {
  const store: Record<string, unknown> = {
    core: {
      i18n: {
        defaultLocale: "en",
        locales: [
          { code: "en", name: "English" },
          { code: "pl", name: "Polski" },
        ],
        sources: [],
      },
    },
    user: userLanguage ? { id: 1, language: userLanguage } : undefined,
  };

  return {
    get: (key: string) => store[key],
    req: { header: () => acceptLanguage },
  } as unknown as Context;
};

describe("I18nModel.resolveLocale", () => {
  it("prefers an explicit locale over everything else", () => {
    const model = new I18nModel(
      makeCtx({ acceptLanguage: "en", userLanguage: "en" }),
    );

    expect(model.resolveLocale("pl")).toBe("pl");
  });

  it("falls through to the user, the header, then the default", () => {
    expect(
      new I18nModel(
        makeCtx({ acceptLanguage: "en", userLanguage: "pl" }),
      ).resolveLocale(),
    ).toBe("pl");

    expect(
      new I18nModel(
        makeCtx({ acceptLanguage: "pl-PL,pl;q=0.9" }),
      ).resolveLocale(),
    ).toBe("pl");

    expect(new I18nModel(makeCtx()).resolveLocale()).toBe("en");
  });

  it("skips a locale the app does not ship", () => {
    const model = new I18nModel(makeCtx({ userLanguage: "de" }));

    expect(model.resolveLocale("fr")).toBe("en");
  });
});

describe("I18nModel.resolveSupportedLocale", () => {
  it("keeps a locale the app ships", () => {
    expect(new I18nModel(makeCtx()).resolveSupportedLocale("pl")).toBe("pl");
  });

  // The one that matters for emails: a recipient whose language was dropped
  // from `i18n.locales` must not inherit the language of whoever triggered
  // the send.
  it("falls straight to the default, ignoring the request", () => {
    const model = new I18nModel(
      makeCtx({ acceptLanguage: "pl-PL,pl;q=0.9", userLanguage: "pl" }),
    );

    expect(model.resolveSupportedLocale("de")).toBe("en");
    expect(model.resolveSupportedLocale()).toBe("en");

    // The contrast that makes the second method worth having.
    expect(model.resolveLocale("de")).toBe("pl");
  });
});
