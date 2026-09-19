import { describe, expect, it } from "vitest";

import type { ZoneCapacity } from "./bounds";

import { refusesDuplicate, refusesRemoval } from "./bounds";

const capacity = (
  blocks: number,
  bounds: { max?: number; min?: number } = {},
): ZoneCapacity => ({ blocks, max: bounds.max, min: bounds.min });

describe("refusesRemoval", () => {
  it("refuses a removal that would take the zone under its min", () => {
    expect(refusesRemoval(capacity(1, { min: 1 }), 1)).toBe(true);
    expect(refusesRemoval(capacity(3, { min: 2 }), 2)).toBe(true);
  });

  it("allows a removal the zone can still afford", () => {
    expect(refusesRemoval(capacity(3, { min: 2 }), 1)).toBe(false);
    expect(refusesRemoval(capacity(1), 1)).toBe(false);
  });

  it("never refuses a removal that takes no blocks with it", () => {
    expect(refusesRemoval(capacity(2, { min: 3 }), 0)).toBe(false);
    expect(refusesRemoval(capacity(0, { min: 1 }), 0)).toBe(false);
  });

  it("has nothing to say about a zone with no bounds", () => {
    expect(refusesRemoval(null, 5)).toBe(false);
  });
});

describe("refusesDuplicate", () => {
  it("refuses a copy that would take the zone over its max", () => {
    expect(refusesDuplicate(capacity(2, { max: 2 }), 1, null)).toBe(true);
    expect(refusesDuplicate(capacity(2, { max: 3 }), 2, null)).toBe(true);
  });

  it("allows a copy that still fits", () => {
    expect(refusesDuplicate(capacity(2, { max: 3 }), 1, null)).toBe(false);
    expect(refusesDuplicate(capacity(9), 1, null)).toBe(false);
  });

  it("refuses a copy an area has no room for, whatever the zone allows", () => {
    expect(refusesDuplicate(capacity(1, { max: 100 }), 1, 50)).toBe(true);
    expect(refusesDuplicate(capacity(1, { max: 100 }), 1, 49)).toBe(false);
  });

  it("has nothing to say about a zone with no bounds", () => {
    expect(refusesDuplicate(null, 5, null)).toBe(false);
  });
});
