import { describe, expect, it } from "vitest";

import { containsLikePattern, escapeLikePattern } from "./like-pattern";

describe("escapeLikePattern", () => {
  it.each([
    ["100%", "100\\%"],
    ["a_b", "a\\_b"],
    ["back\\slash", "back\\\\slash"],
    ["plain", "plain"],
  ])("escapes %s", (input, expected) => {
    expect(escapeLikePattern(input)).toBe(expected);
  });
});

describe("containsLikePattern", () => {
  it("wraps the escaped term in wildcards", () => {
    expect(containsLikePattern("50%_off")).toBe("%50\\%\\_off%");
  });
});
