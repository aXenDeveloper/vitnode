import { describe, expect, it } from "vitest";

import { nextIconIndex } from "./icon-picker";

const move = (key: string, index: number, isRtl = false) =>
  nextIconIndex({ columns: 8, count: 20, index, isRtl, key });

describe("nextIconIndex", () => {
  it("walks the grid one cell or one row at a time", () => {
    expect(move("ArrowRight", 3)).toBe(4);
    expect(move("ArrowLeft", 3)).toBe(2);
    expect(move("ArrowDown", 3)).toBe(11);
    expect(move("ArrowUp", 11)).toBe(3);
  });

  it("stays put at the edges instead of wrapping off the grid", () => {
    expect(move("ArrowLeft", 0)).toBe(0);
    expect(move("ArrowUp", 2)).toBe(2);
    expect(move("ArrowDown", 15)).toBe(15);
    expect(move("ArrowRight", 19)).toBe(19);
  });

  it("jumps to the start and end of the row, stopping at the last icon", () => {
    expect(move("Home", 13)).toBe(8);
    expect(move("End", 9)).toBe(15);
    expect(move("End", 17)).toBe(19);
  });

  it("mirrors left and right in a right-to-left layout", () => {
    expect(move("ArrowRight", 3, true)).toBe(2);
    expect(move("ArrowLeft", 3, true)).toBe(4);
  });

  it("ignores keys that do not navigate", () => {
    expect(move("Enter", 3)).toBeNull();
  });
});
