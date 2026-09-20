// @vitest-environment node
import { describe, expect, it } from "vitest";

import { areaOpenSlots } from "./open-slots";

const slots = (children: number, columns: number, full = false): number =>
  areaOpenSlots({ children, columns, full });

describe("the empty cells an area draws beside what it holds", () => {
  it("offers one per column while the area is empty", () => {
    expect(slots(0, 1)).toBe(1);
    expect(slots(0, 2)).toBe(2);
    expect(slots(0, 4)).toBe(4);
  });

  it("keeps the columns one widget does not fill", () => {
    expect(slots(1, 2)).toBe(1);
    expect(slots(1, 3)).toBe(2);
    expect(slots(1, 4)).toBe(3);
  });

  it("finishes the last row rather than counting from the first", () => {
    expect(slots(3, 2)).toBe(1);
    expect(slots(5, 4)).toBe(3);
    expect(slots(9, 3)).toBe(0);
  });

  it("offers none when the row is already complete", () => {
    expect(slots(2, 2)).toBe(0);
    expect(slots(4, 4)).toBe(0);
    expect(slots(6, 3)).toBe(0);
  });

  it("offers none to an area the zone has no room to add to", () => {
    expect(slots(1, 4, true)).toBe(0);
    expect(slots(3, 2, true)).toBe(0);
  });

  it("still shows an empty area, so the zone's cap has somewhere to say so", () => {
    expect(slots(0, 3, true)).toBe(3);
  });
});
