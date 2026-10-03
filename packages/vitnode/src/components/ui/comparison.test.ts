import { describe, expect, it } from "vitest";

import { positionFromKey, positionFromPointer } from "./comparison-utils";

describe("positionFromPointer", () => {
  it("turns the pointer x into a percentage of the width", () => {
    expect(positionFromPointer(150, { left: 100, width: 200 })).toBe(25);
  });

  it("clamps pointers outside the box", () => {
    expect(positionFromPointer(0, { left: 100, width: 200 })).toBe(0);
    expect(positionFromPointer(900, { left: 100, width: 200 })).toBe(100);
  });

  it("falls back to the middle before the box has a size", () => {
    expect(positionFromPointer(10, { left: 0, width: 0 })).toBe(50);
  });
});

describe("positionFromKey", () => {
  it("moves by 5% with the arrow keys and 10% with shift", () => {
    expect(positionFromKey("ArrowRight", 50, false)).toBe(55);
    expect(positionFromKey("ArrowLeft", 50, false)).toBe(45);
    expect(positionFromKey("ArrowUp", 50, true)).toBe(60);
  });

  it("jumps to the ends with Home and End and never overshoots", () => {
    expect(positionFromKey("Home", 50, false)).toBe(0);
    expect(positionFromKey("End", 50, false)).toBe(100);
    expect(positionFromKey("ArrowRight", 98, false)).toBe(100);
  });

  it("ignores other keys", () => {
    expect(positionFromKey("a", 50, false)).toBeNull();
  });
});
