import { describe, expect, it } from "vitest";

import {
  contentLocalesMatch,
  isContentLocaleShaped,
  negotiateContentLocale,
  normalizeContentLocale,
  parseAcceptLanguage,
  resolveContentPublicLocale,
} from "./locale";

const AVAILABLE = ["en", "pl", "pt-BR"];

describe("normalizeContentLocale", () => {
  it("trims and lower-cases, because a locale travels in a URL", () => {
    expect(normalizeContentLocale("  PL ")).toBe("pl");
  });

  it("matches two spellings of the same language", () => {
    expect(contentLocalesMatch("pt-BR", "pt-br")).toBe(true);
    expect(contentLocalesMatch("pt", "pt-BR")).toBe(false);
  });
});

describe("isContentLocaleShaped", () => {
  it.each([["en"], ["pl"], ["pt-BR"], ["zh-Hans"], ["en_GB"]])(
    "accepts %s",
    value => {
      expect(isContentLocaleShaped(value)).toBe(true);
    },
  );

  it.each([[""], ["  "], ["e"], ["../../etc/passwd"], ["en; DROP TABLE"]])(
    "rejects %s",
    value => {
      expect(isContentLocaleShaped(value)).toBe(false);
    },
  );

  it("rejects a value longer than `core_languages.code`", () => {
    expect(isContentLocaleShaped("a".repeat(64))).toBe(false);
  });
});

describe("parseAcceptLanguage", () => {
  it("orders by quality, best first", () => {
    expect(parseAcceptLanguage("en;q=0.4, pl;q=0.9, de;q=0.1")).toEqual([
      "pl",
      "en",
      "de",
    ]);
  });

  it("treats a missing q as 1", () => {
    expect(parseAcceptLanguage("pl, en;q=0.9")).toEqual(["pl", "en"]);
  });

  it("keeps the sent order for equal quality", () => {
    expect(parseAcceptLanguage("de, pl, en")).toEqual(["de", "pl", "en"]);
  });

  it("drops `q=0`, which is a refusal rather than a low preference", () => {
    expect(parseAcceptLanguage("pl;q=0, en")).toEqual(["en"]);
  });

  it("drops the wildcard, so it never turns a request into a negotiated one", () => {
    expect(parseAcceptLanguage("*")).toEqual([]);
  });

  it("skips garbage instead of throwing on a header anyone can send", () => {
    expect(parseAcceptLanguage(",,;q=;,pl")).toEqual(["pl"]);
  });
});

describe("negotiateContentLocale", () => {
  it("prefers an exact match over a prefix one", () => {
    // `pt, pt-BR` must not resolve to `pt-BR` when `pt` is available.
    expect(negotiateContentLocale("pt, pt-BR", ["pt", "pt-BR"])).toBe("pt");
  });

  it("falls back to a regional variant of the same language", () => {
    expect(negotiateContentLocale("pt", AVAILABLE)).toBe("pt-BR");
  });

  it("returns null when nothing matches", () => {
    expect(negotiateContentLocale("is, fo", AVAILABLE)).toBeNull();
  });

  it("returns the canonical spelling, not the caller's", () => {
    expect(negotiateContentLocale("PT-br", AVAILABLE)).toBe("pt-BR");
  });
});

describe("resolveContentPublicLocale", () => {
  const resolve = (
    input: Partial<Parameters<typeof resolveContentPublicLocale>[0]>,
  ) =>
    resolveContentPublicLocale({
      available: AVAILABLE,
      defaultLocale: "en",
      ...input,
    });

  it("prefers an explicit locale over everything else", () => {
    expect(resolve({ acceptLanguage: "pl", explicit: "pt-BR" })).toEqual({
      locale: "pt-BR",
      source: "explicit",
    });
  });

  it("refuses an explicit locale that names no available language", () => {
    // Not a substitution: answering a `/de/` URL with English would be the
    // wrong page, cached under the German tag.
    expect(resolve({ explicit: "de" })).toBeNull();
  });

  it("refuses an explicit locale that is not locale-shaped", () => {
    expect(resolve({ explicit: "../en" })).toBeNull();
  });

  it("negotiates when there is no explicit locale", () => {
    expect(resolve({ acceptLanguage: "pl;q=0.9, en;q=0.4" })).toEqual({
      locale: "pl",
      source: "negotiated",
    });
  });

  it("falls through to the default when nothing negotiates", () => {
    // A preference, not an instruction: a visitor whose browser asks for
    // Icelandic gets the site rather than a 404.
    expect(resolve({ acceptLanguage: "is" })).toEqual({
      locale: "en",
      source: "default",
    });
  });

  it("uses the default with no explicit locale and no header", () => {
    expect(resolve({})).toEqual({ locale: "en", source: "default" });
  });

  it("treats an empty explicit locale as absent", () => {
    expect(resolve({ explicit: "  " })).toEqual({
      locale: "en",
      source: "default",
    });
  });

  it("returns the canonical spelling of an explicit locale", () => {
    expect(resolve({ explicit: "PL" })).toEqual({
      locale: "pl",
      source: "explicit",
    });
  });

  it("still answers when the default itself is not in the available set", () => {
    // A misconfigured install is the boot guard's problem to report, not a
    // reason for every public URL to 404.
    expect(
      resolveContentPublicLocale({
        available: ["pl"],
        defaultLocale: "en",
      }),
    ).toEqual({ locale: "en", source: "default" });
  });
});
