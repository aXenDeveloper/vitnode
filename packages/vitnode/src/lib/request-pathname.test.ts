import { describe, expect, it } from "vitest";

import { stripLocalePrefix } from "./request-pathname";

describe("stripLocalePrefix", () => {
  const locales = ["en", "pl"];

  it("drops a leading locale segment", () => {
    expect(stripLocalePrefix("/pl/admin/core", locales)).toBe("/admin/core");
    expect(stripLocalePrefix("/en", locales)).toBe("/");
  });

  it("leaves an unprefixed path alone", () => {
    expect(stripLocalePrefix("/admin/core", locales)).toBe("/admin/core");
    expect(stripLocalePrefix("/", locales)).toBe("/");
  });

  it("only matches whole segments", () => {
    expect(stripLocalePrefix("/entries/1", locales)).toBe("/entries/1");
    expect(stripLocalePrefix("/admin/en/core", locales)).toBe("/admin/en/core");
  });
});
