import { describe, expect, it } from "vitest";

import type { AdminNavigationItem } from "./navigation-query";

import {
  applyNavigationDrop,
  flattenNavigationItems,
  NAVIGATION_INDENTATION_PX,
  navigationItemIcon,
  navigationItemsFrom,
  navigationOrderBody,
  projectNavigationDrop,
  sameNavigationOrder,
  withoutNavigationChildrenOf,
} from "./navigation-tree";

const at = new Date("2026-09-20T10:00:00Z");

const item = (
  id: number,
  position: number,
  parentId: null | number = null,
): AdminNavigationItem => ({
  createdAt: at,
  description: [],
  href: `/${String(id)}`,
  icon: null,
  id,
  isOpenInNewTab: false,
  kind: "custom",
  parentId,
  pluginId: null,
  position,
  preset: null,
  presetId: null,
  title: [{ languageCode: "en", value: `Item ${String(id)}` }],
  updatedAt: at,
});

const menu = [item(1, 0), item(2, 1), item(3, 0, 2), item(4, 1, 2), item(5, 2)];

const ids = (flattened: ReturnType<typeof flattenNavigationItems>) =>
  flattened.map(entry => `${String(entry.item.id)}@${String(entry.depth)}`);

describe("navigationItemIcon", () => {
  it("prefers the item's own icon", () => {
    expect(
      navigationItemIcon({
        icon: "icon:star",
        preset: {
          href: "/discover",
          icon: "icon:compass",
          id: "discover",
          isOpenInNewTab: false,
          pluginId: "@vitnode/core",
        },
      }),
    ).toBe("icon:star");
  });

  it("falls back to the icon the prebuilt page ships", () => {
    expect(
      navigationItemIcon({
        icon: null,
        preset: {
          href: "/discover",
          icon: "icon:compass",
          id: "discover",
          isOpenInNewTab: false,
          pluginId: "@vitnode/core",
        },
      }),
    ).toBe("icon:compass");
  });

  it("has none for a custom link that was given none", () => {
    expect(navigationItemIcon({ icon: null, preset: null })).toBeNull();
  });
});

describe("flattenNavigationItems", () => {
  it("lists roots in position order with their children right below", () => {
    expect(ids(flattenNavigationItems(menu))).toEqual([
      "1@0",
      "2@0",
      "3@1",
      "4@1",
      "5@0",
    ]);
  });

  it("lifts a grandchild to the top level rather than drawing two levels", () => {
    expect(
      ids(flattenNavigationItems([item(1, 0), item(2, 0, 1), item(3, 0, 2)])),
    ).toEqual(["1@0", "2@1", "3@0"]);
  });
});

describe("projectNavigationDrop", () => {
  const flattened = flattenNavigationItems(menu);

  it("nests an item dragged to the right under the item above it", () => {
    expect(
      projectNavigationDrop({
        activeHasChildren: false,
        activeId: 5,
        flattened,
        indentationWidth: NAVIGATION_INDENTATION_PX,
        offsetLeft: NAVIGATION_INDENTATION_PX,
        overId: 5,
      }),
    ).toEqual({ depth: 1, parentId: 2 });
  });

  it("never goes deeper than one level", () => {
    expect(
      projectNavigationDrop({
        activeHasChildren: false,
        activeId: 5,
        flattened,
        indentationWidth: NAVIGATION_INDENTATION_PX,
        offsetLeft: NAVIGATION_INDENTATION_PX * 3,
        overId: 5,
      }),
    ).toEqual({ depth: 1, parentId: 2 });
  });

  it("keeps a parent with children at the top level", () => {
    expect(
      projectNavigationDrop({
        activeHasChildren: true,
        activeId: 2,
        flattened: withoutNavigationChildrenOf(flattened, 2),
        indentationWidth: NAVIGATION_INDENTATION_PX,
        offsetLeft: NAVIGATION_INDENTATION_PX,
        overId: 5,
      }),
    ).toEqual({ depth: 0, parentId: null });
  });

  it("cannot become a root between a parent and its children", () => {
    expect(
      projectNavigationDrop({
        activeHasChildren: false,
        activeId: 1,
        flattened,
        indentationWidth: NAVIGATION_INDENTATION_PX,
        offsetLeft: 0,
        overId: 3,
      }),
    ).toEqual({ depth: 1, parentId: 2 });
  });

  it("has nothing to nest under at the very top", () => {
    expect(
      projectNavigationDrop({
        activeHasChildren: false,
        activeId: 5,
        flattened,
        indentationWidth: NAVIGATION_INDENTATION_PX,
        offsetLeft: NAVIGATION_INDENTATION_PX,
        overId: 1,
      }),
    ).toEqual({ depth: 0, parentId: null });
  });
});

describe("applyNavigationDrop and navigationOrderBody", () => {
  it("moves a parent with its children and re-parents what follows", () => {
    const flattened = flattenNavigationItems(menu);
    const next = applyNavigationDrop({
      activeId: 2,
      children: flattened.filter(entry => entry.parentId === 2),
      flattened: withoutNavigationChildrenOf(flattened, 2),
      overId: 5,
      projection: { depth: 0, parentId: null },
    });

    expect(ids(next)).toEqual(["1@0", "5@0", "2@0", "3@1", "4@1"]);
    expect(navigationOrderBody(next)).toEqual({
      items: [
        { children: [], id: 1 },
        { children: [], id: 5 },
        { children: [3, 4], id: 2 },
      ],
    });
  });

  it("pulls a child out to the top level and drops it below its old parent", () => {
    const flattened = flattenNavigationItems(menu);
    const next = applyNavigationDrop({
      activeId: 4,
      children: [],
      flattened,
      overId: 5,
      projection: { depth: 0, parentId: null },
    });

    expect(navigationOrderBody(next)).toEqual({
      items: [
        { children: [], id: 1 },
        { children: [3], id: 2 },
        { children: [], id: 5 },
        { children: [], id: 4 },
      ],
    });
  });

  it("rebuilds positions per parent for the optimistic list", () => {
    const next = navigationItemsFrom(
      applyNavigationDrop({
        activeId: 5,
        children: [],
        flattened: flattenNavigationItems(menu),
        overId: 5,
        projection: { depth: 1, parentId: 2 },
      }),
    );

    expect(
      next.map(entry => [entry.id, entry.parentId, entry.position]),
    ).toEqual([
      [1, null, 0],
      [2, null, 1],
      [3, 2, 0],
      [4, 2, 1],
      [5, 2, 2],
    ]);
  });
});

describe("sameNavigationOrder", () => {
  it("tells an unchanged drop from a real move", () => {
    const body = navigationOrderBody(flattenNavigationItems(menu));

    expect(sameNavigationOrder(body, body)).toBe(true);
    expect(
      sameNavigationOrder(body, {
        items: [...body.items].reverse(),
      }),
    ).toBe(false);
  });
});
