import { describe, expect, it } from "vitest";

import { tablePageWindow } from "./page-window";

describe("tablePageWindow", () => {
  it("shows nothing when there is nothing to page", () => {
    expect(tablePageWindow({ current: 1, total: 0 })).toEqual([]);
  });

  it("shows every page while they still fit", () => {
    expect(tablePageWindow({ current: 3, total: 7 })).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it("gaps only the far side while near the start", () => {
    expect(tablePageWindow({ current: 2, total: 20 })).toEqual([
      1,
      2,
      3,
      4,
      5,
      "ellipsis",
      20,
    ]);
  });

  it("gaps only the near side while at the end", () => {
    expect(tablePageWindow({ current: 20, total: 20 })).toEqual([
      1,
      "ellipsis",
      16,
      17,
      18,
      19,
      20,
    ]);
  });

  it("gaps both sides in the middle", () => {
    expect(tablePageWindow({ current: 10, total: 20 })).toEqual([
      1,
      "ellipsis",
      9,
      10,
      11,
      "ellipsis",
      20,
    ]);
  });

  it("keeps the first and last page reachable from anywhere", () => {
    for (let current = 1; current <= 50; current += 1) {
      const slots = tablePageWindow({ current, total: 50 });

      expect(slots.at(0)).toBe(1);
      expect(slots.at(-1)).toBe(50);
      expect(slots).toContain(current);
    }
  });

  it("never repeats a page or runs them out of order", () => {
    for (let total = 1; total <= 30; total += 1) {
      for (let current = 1; current <= total; current += 1) {
        const pages = tablePageWindow({ current, total }).filter(
          (slot): slot is number => slot !== "ellipsis",
        );

        expect(new Set(pages).size).toBe(pages.length);
        expect([...pages].sort((a, b) => a - b)).toEqual(pages);
      }
    }
  });

  it("clamps a page outside the range onto the range", () => {
    expect(tablePageWindow({ current: 99, total: 5 })).toEqual([1, 2, 3, 4, 5]);
    expect(tablePageWindow({ current: 0, total: 5 })).toEqual([1, 2, 3, 4, 5]);
  });
});
