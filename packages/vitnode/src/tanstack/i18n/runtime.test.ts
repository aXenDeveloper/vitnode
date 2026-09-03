import { describe, expect, it } from "vitest";

import type { VitNodeI18nConfig } from "@/lib/i18n/types";

import type { IntlMessages } from "./runtime";

import { configureIntl, getIntlRuntime, resetIntlRuntime } from "./runtime";

const i18nConfig = (
  locales: string[],
  defaultLocale: string,
  timeZone?: string,
): VitNodeI18nConfig => ({
  defaultLocale,
  locales: locales.map(code => ({ code, name: code })),
  ...(timeZone === undefined ? {} : { timeZone }),
});

const fetcherNamed = (name: string) => {
  const fetchMessages = async (): Promise<IntlMessages> =>
    Promise.resolve({ locale: name, messages: {} });

  return fetchMessages;
};

describe("before the host configures it", () => {
  it("throws rather than falling back to a default language", () => {
    resetIntlRuntime();

    expect(() => getIntlRuntime()).toThrow(/not configured/);
  });

  it("names the call that fixes it", () => {
    resetIntlRuntime();

    expect(() => getIntlRuntime()).toThrow(/configureIntl/);
  });
});

describe("first registration", () => {
  it("derives the locale routing from the config it was handed", () => {
    const runtime = configureIntl({
      fetchMessages: fetcherNamed("first"),
      i18n: i18nConfig(["en", "pl"], "en"),
    });

    expect(runtime.defaultLocale).toBe("en");
    expect(runtime.isLocale("pl")).toBe(true);
    expect(runtime.isLocale("de")).toBe(false);
  });

  it("returns the same runtime it registered, so the host derives nothing twice", () => {
    const runtime = configureIntl({
      fetchMessages: fetcherNamed("first"),
      i18n: i18nConfig(["en"], "en"),
    });

    expect(getIntlRuntime()).toBe(runtime);
  });

  it("carries the time zone through, so a server render does not guess one", () => {
    configureIntl({
      fetchMessages: fetcherNamed("first"),
      i18n: i18nConfig(["en"], "en", "Europe/Warsaw"),
    });

    expect(getIntlRuntime().timeZone).toBe("Europe/Warsaw");
  });
});

describe("the same registration repeated", () => {
  it("is not an error, and leaves an equivalent runtime", () => {
    const options = {
      fetchMessages: fetcherNamed("same"),
      i18n: i18nConfig(["en", "pl"], "en"),
    };

    configureIntl(options);
    configureIntl(options);

    expect(getIntlRuntime().fetchMessages).toBe(options.fetchMessages);
    expect(getIntlRuntime().defaultLocale).toBe("en");
  });
});

describe("a new registration after a hot reload", () => {
  it("accepts a replacement module's new fetcher rather than throwing", () => {
    configureIntl({
      fetchMessages: fetcherNamed("before"),
      i18n: i18nConfig(["en"], "en"),
    });

    const after = fetcherNamed("after");

    expect(() => {
      configureIntl({ fetchMessages: after, i18n: i18nConfig(["en"], "en") });
    }).not.toThrow();

    expect(getIntlRuntime().fetchMessages).toBe(after);
  });

  it("rebuilds the locale table when the language list changes", () => {
    configureIntl({
      fetchMessages: fetcherNamed("before"),
      i18n: i18nConfig(["en"], "en"),
    });

    expect(getIntlRuntime().isLocale("pl")).toBe(false);

    configureIntl({
      fetchMessages: fetcherNamed("after"),
      i18n: i18nConfig(["en", "pl"], "en"),
    });

    expect(getIntlRuntime().isLocale("pl")).toBe(true);
  });

  it("follows a changed default language", () => {
    configureIntl({
      fetchMessages: fetcherNamed("before"),
      i18n: i18nConfig(["en", "pl"], "en"),
    });
    configureIntl({
      fetchMessages: fetcherNamed("after"),
      i18n: i18nConfig(["en", "pl"], "pl"),
    });

    expect(getIntlRuntime().defaultLocale).toBe("pl");
  });

  it("leaves no caller holding the previous runtime", () => {
    const readNow = () => getIntlRuntime();

    configureIntl({
      fetchMessages: fetcherNamed("before"),
      i18n: i18nConfig(["en"], "en"),
    });

    const first = readNow();

    configureIntl({
      fetchMessages: fetcherNamed("after"),
      i18n: i18nConfig(["en"], "en"),
    });

    expect(readNow()).not.toBe(first);
    expect(readNow()).toBe(getIntlRuntime());
  });

  /**
   * One store, not several. Every read goes through the same slot, so there is
   * no arrangement in which two consumers see two different registrations.
   */
  it("keeps exactly one current registration", () => {
    configureIntl({
      fetchMessages: fetcherNamed("a"),
      i18n: i18nConfig(["en"], "en"),
    });
    configureIntl({
      fetchMessages: fetcherNamed("b"),
      i18n: i18nConfig(["en"], "en"),
    });
    const last = configureIntl({
      fetchMessages: fetcherNamed("c"),
      i18n: i18nConfig(["en"], "en"),
    });

    expect(getIntlRuntime()).toBe(last);
  });
});

describe("the host's own IntlProvider", () => {
  it("is replaced along with the rest of the runtime", () => {
    const before = () => null;
    const after = () => null;

    configureIntl({
      fetchMessages: fetcherNamed("before"),
      hostIntlProvider: before,
      i18n: i18nConfig(["en"], "en"),
    });
    expect(getIntlRuntime().hostIntlProvider).toBe(before);

    configureIntl({
      fetchMessages: fetcherNamed("after"),
      hostIntlProvider: after,
      i18n: i18nConfig(["en"], "en"),
    });
    expect(getIntlRuntime().hostIntlProvider).toBe(after);
  });

  it("is dropped by a registration that does not provide one", () => {
    configureIntl({
      fetchMessages: fetcherNamed("before"),
      hostIntlProvider: () => null,
      i18n: i18nConfig(["en"], "en"),
    });

    configureIntl({
      fetchMessages: fetcherNamed("after"),
      i18n: i18nConfig(["en"], "en"),
    });

    expect(getIntlRuntime().hostIntlProvider).toBeUndefined();
  });
});
