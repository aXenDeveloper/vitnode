import { describe, expect, it } from "vitest";

import {
  componentNameToIconName,
  humanizeIconName,
  iconNameToComponentName,
  parseEmojiIcon,
  serializeEmojiIcon,
} from "./emoji-icon";

describe("parseEmojiIcon", () => {
  it("reads both schemes back", () => {
    expect(parseEmojiIcon("emoji:🚀")).toEqual({ type: "emoji", value: "🚀" });
    expect(parseEmojiIcon("icon:rocket")).toEqual({
      type: "icon",
      value: "rocket",
    });
  });

  it("keeps multi-codepoint emoji whole", () => {
    expect(parseEmojiIcon("emoji:👨‍👩‍👧‍👦")).toEqual({
      type: "emoji",
      value: "👨‍👩‍👧‍👦",
    });
    expect(parseEmojiIcon("emoji:👍🏽")).toEqual({ type: "emoji", value: "👍🏽" });
    expect(parseEmojiIcon("emoji:🇵🇱")).toEqual({ type: "emoji", value: "🇵🇱" });
  });

  it("accepts the icon names that carry digits", () => {
    expect(parseEmojiIcon("icon:volume-2")?.value).toBe("volume-2");
    expect(parseEmojiIcon("icon:grid-2x2")?.value).toBe("grid-2x2");
  });

  it("rejects anything that is not one emoji or one icon name", () => {
    expect(parseEmojiIcon("")).toBeUndefined();
    expect(parseEmojiIcon(null)).toBeUndefined();
    expect(parseEmojiIcon(undefined)).toBeUndefined();
    expect(parseEmojiIcon("rocket")).toBeUndefined();
    expect(parseEmojiIcon("emoji:")).toBeUndefined();
    expect(parseEmojiIcon("icon:")).toBeUndefined();
    expect(parseEmojiIcon("emoji:not-an-emoji")).toBeUndefined();
    expect(parseEmojiIcon("emoji:🚀🚀")).toBeUndefined();
    expect(parseEmojiIcon("icon:Rocket")).toBeUndefined();
    expect(parseEmojiIcon("icon:../../etc/passwd")).toBeUndefined();
    expect(parseEmojiIcon("image:https://example.com/a.png")).toBeUndefined();
  });

  it("rejects a value long enough to be a payload rather than a name", () => {
    expect(parseEmojiIcon(`icon:${"a".repeat(120)}`)).toBeUndefined();
  });

  it("ignores surrounding whitespace", () => {
    expect(parseEmojiIcon("  icon:rocket  ")).toEqual({
      type: "icon",
      value: "rocket",
    });
  });
});

describe("serializeEmojiIcon", () => {
  it("round-trips through parseEmojiIcon", () => {
    for (const value of [
      { type: "emoji", value: "🚀" },
      { type: "icon", value: "shield-check" },
    ] as const) {
      expect(parseEmojiIcon(serializeEmojiIcon(value))).toEqual(value);
    }
  });

  it("turns an absent value into the empty string the form clears to", () => {
    expect(serializeEmojiIcon(undefined)).toBe("");
    expect(serializeEmojiIcon(null)).toBe("");
  });
});

describe("icon name conversion", () => {
  it("round-trips a Lucide component name", () => {
    for (const componentName of [
      "Rocket",
      "AArrowDown",
      "ALargeSmall",
      "ShieldCheck",
      "Volume2",
      "Grid2x2",
    ]) {
      expect(
        iconNameToComponentName(componentNameToIconName(componentName)),
      ).toBe(componentName);
    }
  });

  it("resolves both spellings of the names Lucide hyphenates differently", () => {
    expect(iconNameToComponentName("grid-2x2")).toBe("Grid2x2");
    expect(iconNameToComponentName("grid-2x-2")).toBe("Grid2x2");
  });

  it("reads an icon name as words", () => {
    expect(humanizeIconName("arrow-up-right")).toBe("Arrow Up Right");
    expect(humanizeIconName("rocket")).toBe("Rocket");
  });
});
