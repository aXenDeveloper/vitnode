import { describe, expect, it } from "vitest";

import type { VitNodeI18nConfig } from "@/lib/i18n/types";

import type { IntlMessages } from "./runtime";

import { configureIntl, getIntlRuntime, resetIntlRuntime } from "./runtime";

/**
 * The i18n runtime's registration lifecycle - the third module-scope bridge in
 * this package, and the one that holds the most.
 *
 * `setAuthTransport` and `setAdminTransport` hold a function each. This holds a
 * language list, a default, a time zone, a message fetcher and - under `vite
 * dev` - the host's own `IntlProvider`. All of them are decided when the app is
 * built and none of them varies between requests, which is the argument for a
 * module-level value on a server rendering many visitors at once.
 *
 * Which makes the reload question sharper rather than softer: everything here is
 * *derived* at registration time (`localeRoutingFromConfig`, and an `isLocale`
 * that closes over the result), so a registry that kept its first answer would
 * hold a locale table built from a config the author has since edited. The
 * transitions below pin that it does not.
 */

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

  /**
   * The message names the fix, because an app that reached here without
   * configuring is one whose router entry does not import its i18n module - and
   * every string it renders would otherwise be silently English.
   */
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

  /**
   * The stale-closure case that matters most here, because `isLocale` is not a
   * value but a *closure over the derived routing*. Adding a language to the
   * config has to make the new one supported - a registry that kept the first
   * closure would keep rejecting it, and the symptom would be a 404 on a URL the
   * config plainly allows.
   */
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

  /**
   * A caller that reads at call time - which every caller in this namespace does
   * - sees the replacement. Nothing captures the runtime at module scope, and
   * this is the assertion that says so.
   */
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
  /**
   * Optional, and only load-bearing under `vite dev` - but it is registered
   * through the same slot as everything else, so it has to survive a
   * replacement the same way. See `./route-messages.tsx`.
   */
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
