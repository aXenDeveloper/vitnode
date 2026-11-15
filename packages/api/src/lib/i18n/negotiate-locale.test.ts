import { describe, expect, it } from "vitest";

import { negotiateLocale } from "./negotiate-locale";

describe("negotiateLocale", () => {
  it("returns undefined without a header or without locales", () => {
    expect(negotiateLocale(undefined, ["en"])).toBeUndefined();
    expect(negotiateLocale(null, ["en"])).toBeUndefined();
    expect(negotiateLocale("pl", [])).toBeUndefined();
  });

  it("matches an exact tag", () => {
    expect(negotiateLocale("pl", ["en", "pl"])).toBe("pl");
  });

  it("falls back to the primary subtag", () => {
    expect(negotiateLocale("pl-PL", ["en", "pl"])).toBe("pl");
  });

  it("honours q weights over header order", () => {
    expect(negotiateLocale("de;q=0.2,pl;q=0.9", ["de", "en", "pl"])).toBe("pl");
  });

  it("keeps header order when weights tie", () => {
    expect(negotiateLocale("de,pl", ["de", "en", "pl"])).toBe("de");
  });

  it("skips q=0 and unknown languages", () => {
    expect(negotiateLocale("pl;q=0,de", ["de", "pl"])).toBe("de");
    expect(negotiateLocale("fr,es", ["en", "pl"])).toBeUndefined();
  });

  it("treats a wildcard as the first configured locale", () => {
    expect(negotiateLocale("*", ["en", "pl"])).toBe("en");
  });
});
