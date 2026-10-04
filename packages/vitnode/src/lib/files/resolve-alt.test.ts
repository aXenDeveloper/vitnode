import { describe, expect, it } from "vitest";

import { resolveImageAlt } from "./resolve-alt";

const alts = { en: "A red bicycle", pl: "Czerwony rower" };

describe("resolveImageAlt", () => {
  it("prefers the occurrence's own text", () => {
    expect(
      resolveImageAlt({ alts, locale: "pl", occurrence: { alt: "Mój rower" } }),
    ).toEqual({ alt: "Mój rower", source: "occurrence" });
  });

  it("keeps a decorative occurrence empty, whatever the file says", () => {
    expect(
      resolveImageAlt({ alts, locale: "pl", occurrence: { decorative: true } }),
    ).toEqual({ alt: "", source: "decorative" });
  });

  it("falls back to the file's ALT in the requested language", () => {
    expect(
      resolveImageAlt({ alts, locale: "pl", occurrence: { alt: null } }),
    ).toEqual({
      alt: "Czerwony rower",
      source: "file",
    });
  });

  it("keeps an intentionally empty file ALT instead of a truthy fallback", () => {
    expect(
      resolveImageAlt({
        alts: { en: "A red bicycle", pl: "" },
        fallbackLocales: ["en"],
        locale: "pl",
      }),
    ).toEqual({ alt: "", source: "file" });
  });

  it("uses a configured fallback language, then reports the gap", () => {
    expect(
      resolveImageAlt({ alts, fallbackLocales: ["en"], locale: "de" }),
    ).toEqual({ alt: "A red bicycle", source: "fallback" });
    expect(resolveImageAlt({ alts: {}, locale: "de" })).toEqual({
      alt: "",
      source: "missing",
    });
  });
});
