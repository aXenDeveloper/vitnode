import { describe, expect, it } from "vitest";

import { normalizeProfileSearch } from "./route-search";

describe("normalizeProfileSearch", () => {
  it.each([
    [{}, {}],
    [{ tab: "activity" }, {}],
    [{ tab: "content" }, { tab: "content" }],
    [
      { tab: "content", type: "forum.comment" },
      { tab: "content", type: "forum.comment" },
    ],
    [
      { tab: "content", type: "shop.gift-card" },
      { tab: "content", type: "shop.gift-card" },
    ],
    [{ type: "forum.comment" }, {}],
    [{ tab: "CONTENT", type: "forum.comment" }, {}],
    [{ tab: "content", type: "Forum.Comment" }, { tab: "content" }],
    [{ tab: "content", type: "forum" }, { tab: "content" }],
    [{ tab: "content", type: "forum..comment" }, { tab: "content" }],
    [{ tab: "content", type: "<script>.x" }, { tab: "content" }],
    [
      { tab: "content", type: `a.${"b".repeat(62)}` },
      { tab: "content", type: `a.${"b".repeat(62)}` },
    ],
    [{ tab: "content", type: `a.${"b".repeat(63)}` }, { tab: "content" }],
    [{ tab: "content", type: 42 }, { tab: "content" }],
    [{ tab: "content", type: ["forum.comment"] }, { tab: "content" }],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeProfileSearch(input)).toEqual(expected);
  });
});
