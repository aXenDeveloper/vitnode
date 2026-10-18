import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { hasTipContent } from "./tip";

describe("hasTipContent", () => {
  it.each([
    { name: "undefined", tip: undefined, expected: false },
    { name: "null", tip: null, expected: false },
    { name: "false", tip: false, expected: false },
    { name: "true", tip: true, expected: false },
    { name: "an empty string", tip: "", expected: false },
    { name: "a blank string", tip: "   ", expected: false },
    { name: "text", tip: "Shown in search results", expected: true },
    { name: "zero", tip: 0, expected: true },
    {
      name: "an element",
      tip: createElement("strong", null, "Heads up"),
      expected: true,
    },
  ])("$name -> $expected", ({ tip, expected }) => {
    expect(hasTipContent(tip)).toBe(expected);
  });
});
