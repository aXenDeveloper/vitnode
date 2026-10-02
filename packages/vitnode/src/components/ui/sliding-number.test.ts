import { describe, expect, it } from "vitest";

import { digitFaceOffset, numberPlaces } from "./sliding-number";

describe("digitFaceOffset", () => {
  it("puts the current digit in view and its neighbours above and below", () => {
    expect(digitFaceOffset(3, 3)).toBe(0);
    expect(digitFaceOffset(4, 3)).toBe(1);
    expect(digitFaceOffset(2, 3)).toBe(-1);
  });

  it("wraps around so 9 sits right above 0", () => {
    expect(digitFaceOffset(9, 10)).toBe(-1);
    expect(digitFaceOffset(0, 9)).toBe(1);
  });

  it("follows the rolled value between two digits", () => {
    expect(digitFaceOffset(1, 0.5)).toBeCloseTo(0.5);
  });
});

describe("numberPlaces", () => {
  it("lists one place per digit, biggest first", () => {
    expect(numberPlaces(0)).toEqual([1]);
    expect(numberPlaces(7)).toEqual([1]);
    expect(numberPlaces(1204)).toEqual([1000, 100, 10, 1]);
  });

  it("ignores the sign", () => {
    expect(numberPlaces(-42)).toEqual([10, 1]);
  });
});
