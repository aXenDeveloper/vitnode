// @vitest-environment node
import { describe, expect, it } from "vitest";

import { reorderNavigationTree } from "./reorder";

describe("reorderNavigationTree", () => {
  it("turns an ordered tree into parent and position per item", () => {
    expect(
      reorderNavigationTree(
        [
          { children: [3], id: 2 },
          { children: [], id: 1 },
        ],
        [1, 2, 3],
      ),
    ).toEqual({
      ok: true,
      placements: [
        { id: 2, parentId: null, position: 0 },
        { id: 3, parentId: 2, position: 0 },
        { id: 1, parentId: null, position: 1 },
      ],
    });
  });

  it("refuses an id that appears twice, as a root or a child", () => {
    expect(
      reorderNavigationTree(
        [
          { children: [1], id: 2 },
          { children: [], id: 1 },
        ],
        [1, 2],
      ),
    ).toEqual({ ok: false, reason: "duplicate" });
  });

  it("refuses an id that is not in the menu", () => {
    expect(reorderNavigationTree([{ children: [9], id: 1 }], [1, 2])).toEqual({
      ok: false,
      reason: "unknown",
    });
  });

  it("refuses an order that leaves an item out", () => {
    expect(reorderNavigationTree([{ children: [], id: 1 }], [1, 2])).toEqual({
      ok: false,
      reason: "incomplete",
    });
  });
});
