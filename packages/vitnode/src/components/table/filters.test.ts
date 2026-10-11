import { describe, expect, it } from "vitest";

import { nextFilterSelection } from "./filters";

describe("nextFilterSelection", () => {
  it("replaces the value of a single-value filter, and clears it on a second pick", () => {
    expect(nextFilterSelection([], "hidden", true)).toEqual(["hidden"]);
    expect(nextFilterSelection(["hidden"], "visible", true)).toEqual([
      "visible",
    ]);
    expect(nextFilterSelection(["hidden"], "hidden", true)).toEqual([]);
  });

  it("toggles one value of a multi-value filter, keeping the rest", () => {
    expect(nextFilterSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(nextFilterSelection(["a", "b"], "a")).toEqual(["b"]);
  });
});
