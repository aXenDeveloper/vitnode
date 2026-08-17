import { describe, expect, it } from "vitest";

import { CONTENT_SLUG_DEFAULT_LENGTH } from "./const";
import { slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Hello World", "hello-world"],
    ["  Hello   World ", "hello-world"],
    ["hello---world", "hello-world"],
    ["HELLO WORLD", "hello-world"],
    ["already-a-slug", "already-a-slug"],
    ["Hello, World! (2026)", "hello-world-2026"],
    ["--leading and trailing--", "leading-and-trailing"],
    ["under_scores.and.dots", "under-scores-and-dots"],
    ["100% pure", "100-pure"],
    ["a/b/c", "a-b-c"],
  ])("normalises %j to %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it.each([
    ["Zażółć gęślą", "zazolc-gesla"],
    ["Café Crème", "cafe-creme"],
    ["Łódź", "lodz"],
    ["Straße", "strasse"],
    ["Nærøy", "naeroy"],
    ["Þingvellir", "thingvellir"],
  ])("transliterates %j to %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("is deterministic", () => {
    // Nothing random and nothing numeric is appended - two calls with the same
    // input have to agree, or a slug could not be regenerated or asserted on.
    expect(slugify("Hello World")).toBe(slugify("Hello World"));
    expect(slugify("Hello World")).not.toContain("2");
  });

  it.each([
    ["", ""],
    ["   ", ""],
    ["!!!", ""],
    ["日本語", ""],
    ["Привет", ""],
    ["🎉", ""],
    ["---", ""],
  ])("folds %j to an empty slug", (input, expected) => {
    // The caller decides what to do about it. There is no random or numeric
    // fallback: an unaddressable row is better refused than silently invented.
    expect(slugify(input)).toBe(expected);
  });

  describe("length", () => {
    it("truncates to the default", () => {
      const slug = slugify("a".repeat(500));

      expect(slug).toHaveLength(CONTENT_SLUG_DEFAULT_LENGTH);
    });

    it("truncates to an explicit maximum", () => {
      expect(slugify("hello world", 7)).toBe("hello-w");
    });

    it("never leaves a trailing dash behind", () => {
      // The cut lands exactly on the separator.
      expect(slugify("hello world", 6)).toBe("hello");
      expect(slugify("hello world", 5)).toBe("hello");
    });

    it("keeps a short value untouched", () => {
      expect(slugify("hi", 160)).toBe("hi");
    });
  });
});
