import { describe, expect, it } from "vitest";

import { clampOgText, normalizeOgImageText } from "./input";
import { OG_IMAGE_TITLE_MAX_LENGTH } from "./types";

describe("clampOgText", () => {
  it("collapses whitespace and trims", () => {
    expect(clampOgText("  Hello\n\n\tworld  ", 50)).toBe("Hello world");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["only whitespace", " \n\t "],
  ])("answers null for %s", (_label, value) => {
    expect(clampOgText(value, 50)).toBeNull();
  });

  it("keeps text at the limit untouched", () => {
    expect(clampOgText("abcde", 5)).toBe("abcde");
  });

  it("cuts at a word boundary and ends with an ellipsis", () => {
    expect(clampOgText("The quick brown fox jumps", 20)).toBe(
      "The quick brown…",
    );
  });

  it("drops trailing punctuation before the ellipsis", () => {
    expect(clampOgText("Hello, world, again and again", 14)).toBe(
      "Hello, world…",
    );
  });

  it("counts code points, so an emoji is never split in half", () => {
    const clamped = clampOgText("😀".repeat(10), 5);

    expect(clamped).toBe("😀😀😀😀…");
    expect([...(clamped ?? "")]).toHaveLength(5);
  });
});

describe("normalizeOgImageText", () => {
  it("answers null when there is no title left to draw", () => {
    expect(
      normalizeOgImageText({ description: "Something", title: "   " }),
    ).toBeNull();
    expect(normalizeOgImageText({ title: null })).toBeNull();
  });

  it("bounds the title and keeps a missing description null", () => {
    const text = normalizeOgImageText({ title: "word ".repeat(100) });

    expect([...(text?.title ?? "")].length).toBeLessThanOrEqual(
      OG_IMAGE_TITLE_MAX_LENGTH,
    );
    expect(text?.description).toBeNull();
  });

  it.each([
    ["pl", "pl"],
    ["pt-BR", "pt-BR"],
    [null, "en"],
    ["", "en"],
    ["../../etc", "en"],
    ["p", "en"],
  ])("resolves the locale %j to %j", (locale, expected) => {
    expect(normalizeOgImageText({ locale, title: "Hello" })?.locale).toBe(
      expected,
    );
  });
});
