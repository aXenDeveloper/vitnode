import { describe, expect, it } from "vitest";

import { NAVIGATION_BOTTOM_BAR_MAX_ITEMS } from "@/lib/navigation";

import {
  navigationCapacityProblem,
  navigationLocationOf,
  navigationOrderProblem,
  navigationPlacementProblem,
} from "./location";

describe("navigationCapacityProblem", () => {
  it("lets the bottom bar fill up to its limit", () => {
    expect(
      navigationCapacityProblem({
        count: NAVIGATION_BOTTOM_BAR_MAX_ITEMS - 1,
        location: "bottom_bar",
      }),
    ).toBeNull();
  });

  it("refuses a link past the bottom bar's limit", () => {
    expect(
      navigationCapacityProblem({
        count: NAVIGATION_BOTTOM_BAR_MAX_ITEMS,
        location: "bottom_bar",
      }),
    ).toBe("bottomBarFull");
  });

  it("never limits the header", () => {
    expect(
      navigationCapacityProblem({ count: 50, location: "header" }),
    ).toBeNull();
  });
});

describe("navigationPlacementProblem", () => {
  it("allows any top-level item", () => {
    expect(
      navigationPlacementProblem({ location: "bottom_bar", parentId: null }),
    ).toBeNull();
    expect(
      navigationPlacementProblem({ location: "header", parentId: null }),
    ).toBeNull();
  });

  it("allows a header dropdown under a header parent", () => {
    expect(
      navigationPlacementProblem({
        location: "header",
        parentId: 1,
        parentLocation: "header",
      }),
    ).toBeNull();
  });

  it("refuses nesting in the bottom bar", () => {
    expect(
      navigationPlacementProblem({ location: "bottom_bar", parentId: 1 }),
    ).toBe("bottomBarNested");
  });

  it("refuses a parent from the other menu", () => {
    expect(
      navigationPlacementProblem({
        location: "header",
        parentId: 1,
        parentLocation: "bottom_bar",
      }),
    ).toBe("otherLocation");
  });
});

describe("navigationOrderProblem", () => {
  it("accepts a nested header order", () => {
    expect(
      navigationOrderProblem({
        items: [{ children: [2, 3] }],
        location: "header",
      }),
    ).toBeNull();
  });

  it("accepts a flat bottom bar order", () => {
    expect(
      navigationOrderProblem({
        items: [{ children: [] }, { children: [] }],
        location: "bottom_bar",
      }),
    ).toBeNull();
  });

  it("refuses children in a bottom bar order", () => {
    expect(
      navigationOrderProblem({
        items: [{ children: [2] }],
        location: "bottom_bar",
      }),
    ).toBe("bottomBarNested");
  });
});

describe("navigationLocationOf", () => {
  it("reads a stored value, treating anything unknown as the header", () => {
    expect(navigationLocationOf("bottom_bar")).toBe("bottom_bar");
    expect(navigationLocationOf("header")).toBe("header");
    expect(navigationLocationOf("sidebar")).toBe("header");
  });
});
