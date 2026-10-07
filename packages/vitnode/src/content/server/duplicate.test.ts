// @vitest-environment node
import { describe, expect, it } from "vitest";

import { appendContentTitleSuffix, contentSlugCandidate } from "./duplicate";

describe("contentSlugCandidate", () => {
  it("keeps the numeric tail when the base already fills the column", () => {
    expect(contentSlugCandidate("abcdefghij", 1, 10)).toBe("abcdefghij");
    expect(contentSlugCandidate("abcdefghij", 2, 10)).toBe("abcdefgh-2");
    expect(contentSlugCandidate("abcdefghij", 12, 10)).toBe("abcdefg-12");
  });

  it("never leaves a dash in front of the tail", () => {
    expect(contentSlugCandidate("abcdefg-ij", 2, 10)).toBe("abcdefg-2");
  });
});

describe("appendContentTitleSuffix", () => {
  it("leaves a title that fits untouched", () => {
    expect(appendContentTitleSuffix("Hello", "(Copy)", 20)).toBe(
      "Hello (Copy)",
    );
  });

  it("trims the title, never the suffix, and never half a character", () => {
    // 🎉 is two UTF-16 units: cutting between them would store a broken glyph.
    expect(appendContentTitleSuffix("Party 🎉🎉 time", "(Copy)", 15)).toBe(
      "Party 🎉 (Copy)",
    );
  });
});
