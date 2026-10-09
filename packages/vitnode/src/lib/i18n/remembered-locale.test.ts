import { describe, expect, it } from "vitest";

import { localeRoutingFromConfig } from "./locale-routing";
import { urlLocaleToRemember } from "./remembered-locale";

const localeRouting = localeRoutingFromConfig({
  defaultLocale: "en",
  locales: [
    { code: "en", name: "English" },
    { code: "pl", name: "Polski" },
  ],
});

const remember = (pathname: string, cookieHeader?: string) =>
  urlLocaleToRemember({
    cookieHeader,
    host: "vitnode.test",
    localeRouting,
    pathname,
  });

describe("urlLocaleToRemember", () => {
  it("remembers a locale the URL asks for", () => {
    expect(remember("/pl/plugins")).toBe("pl");
  });

  it("leaves a cookie that already says so alone", () => {
    expect(remember("/pl/plugins", "vitnode_locale=pl")).toBeUndefined();
  });

  it("replaces a cookie that says something else", () => {
    expect(remember("/pl", "vitnode_locale=en")).toBe("pl");
  });

  it("does not treat an unprefixed URL as a choice", () => {
    expect(remember("/plugins", "vitnode_locale=pl")).toBeUndefined();
  });

  it("ignores paths that never carry a locale", () => {
    expect(remember("/admin")).toBeUndefined();
  });
});
