import { describe, expect, it } from "vitest";

import { matchEmojis } from "./emoji/match-emojis";
import { createTipTapExtensions, SUPPORTED_HEADINGS_LEVELS } from "./extension";

const emojis = [
  {
    emoji: "\u{1F604}",
    name: "smile",
    shortcodes: ["smile"],
    tags: ["happy", "face"],
  },
  {
    emoji: "\u{1F62D}",
    name: "sob",
    shortcodes: ["sob", "crying"],
    tags: ["sad", "face"],
  },
  {
    emoji: "\u{1F680}",
    name: "rocket",
    shortcodes: ["rocket"],
    tags: ["ship", "launch"],
  },
  {
    emoji: "\u{1F1E6}",
    name: "regional_indicator_a",
    shortcodes: ["regional_indicator_a"],
    tags: [],
  },
  {
    emoji: "\u{1F3FB}",
    group: "components",
    name: "skin_tone_2",
    shortcodes: ["skin_tone_2"],
    tags: [],
  },
  { name: "no_glyph", shortcodes: ["no_glyph"], tags: ["face"] },
];

describe("matchEmojis", () => {
  it("returns the head of the list when the query is blank", () => {
    expect(matchEmojis(emojis, "  ", 2).map(item => item.name)).toEqual([
      "smile",
      "sob",
    ]);
  });

  it("matches on a shortcode regardless of case", () => {
    expect(matchEmojis(emojis, "CRY").map(item => item.name)).toEqual(["sob"]);
  });

  it("matches on a tag", () => {
    expect(matchEmojis(emojis, "face").map(item => item.name)).toEqual([
      "smile",
      "sob",
    ]);
  });

  it("caps the result at the limit", () => {
    expect(matchEmojis(emojis, "", 1)).toHaveLength(1);
  });

  it("returns nothing when nothing matches", () => {
    expect(matchEmojis(emojis, "banana")).toEqual([]);
  });

  it("ranks name matches above tag matches", () => {
    const flags = [
      {
        emoji: "\u{1F38F}",
        name: "carp_streamer",
        shortcodes: ["carp_streamer"],
        tags: ["flags", "koinobori"],
      },
      {
        emoji: "\u{1F3C1}",
        name: "checkered_flag",
        shortcodes: ["checkered_flag"],
        tags: ["race"],
      },
      {
        emoji: "\u{1F1FA}\u{1F1EC}",
        name: "uganda",
        shortcodes: ["flag_ug", "uganda"],
        tags: ["UG", "flag"],
      },
    ];

    expect(matchEmojis(flags, "flag").map(item => item.name)).toEqual([
      "uganda",
      "checkered_flag",
      "carp_streamer",
    ]);
  });

  it("puts an exact shortcode first", () => {
    const items = [
      {
        emoji: "\u{1F604}",
        name: "grinning_face",
        shortcodes: ["smile"],
        tags: [],
      },
      {
        emoji: "\u{1F63A}",
        name: "smiling_cat",
        shortcodes: ["smile_cat"],
        tags: [],
      },
    ];

    expect(matchEmojis(items, "smile").map(item => item.name)).toEqual([
      "grinning_face",
      "smiling_cat",
    ]);
  });

  it("skips regional indicators, skin tones and glyph-less entries", () => {
    expect(matchEmojis(emojis, "").map(item => item.name)).toEqual([
      "smile",
      "sob",
      "rocket",
    ]);
    expect(matchEmojis(emojis, "face").map(item => item.name)).toEqual([
      "smile",
      "sob",
    ]);
  });
});

describe("createTipTapExtensions", () => {
  const names = createTipTapExtensions().map(extension => extension.name);

  it("registers every extension the toolbar drives", () => {
    expect(names).toEqual(
      expect.arrayContaining([
        "audio",
        "color",
        "emoji",
        "fontSize",
        "panel",
        "placeholder",
        "slashCommand",
        "starterKit",
        "submitFormShortcut",
        "tableKit",
        "taskItem",
        "taskList",
        "textAlign",
        "textStyle",
        "typography",
      ]),
    );
  });

  it("keeps dropcursor and trailingNode inside the starter kit", () => {
    const starterKit = createTipTapExtensions().find(
      extension => extension.name === "starterKit",
    );

    expect(starterKit?.options.dropcursor).toMatchObject({
      class: "tiptap-dropcursor",
      width: 2,
    });
    expect(starterKit?.options.trailingNode).toMatchObject({
      node: "paragraph",
    });
    expect(starterKit?.options.heading.levels).toEqual([
      ...SUPPORTED_HEADINGS_LEVELS,
    ]);
  });

  it("passes the placeholder through to the placeholder extension", () => {
    const placeholder = createTipTapExtensions({
      placeholder: "Write something",
    }).find(extension => extension.name === "placeholder");

    expect(placeholder?.options.placeholder).toBe("Write something");
  });
});
