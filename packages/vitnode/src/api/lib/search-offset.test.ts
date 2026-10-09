import { describe, expect, it } from "vitest";

import { MAX_SEARCH_OFFSET, parseSearchOffset } from "./search-offset";

describe("parseSearchOffset", () => {
  it("reads a plain offset", () => {
    expect(parseSearchOffset("0")).toBe(0);
    expect(parseSearchOffset("40")).toBe(40);
  });

  it("treats a missing cursor as the first page", () => {
    expect(parseSearchOffset(undefined)).toBeUndefined();
    expect(parseSearchOffset("")).toBeUndefined();
  });

  it.each(["abc", "-1", "1.5", "1e400", "NaN", "9007199254740993"])(
    "rejects %s instead of passing it to the engine",
    cursor => {
      expect(parseSearchOffset(cursor)).toBeUndefined();
    },
  );

  it("clamps a huge offset to the search window", () => {
    expect(parseSearchOffset("99999999")).toBe(MAX_SEARCH_OFFSET);
  });

  it("clamps to a caller's own window", () => {
    expect(parseSearchOffset("99999999", MAX_SEARCH_OFFSET - 20)).toBe(9980);
    expect(parseSearchOffset("5", -10)).toBe(0);
  });
});
