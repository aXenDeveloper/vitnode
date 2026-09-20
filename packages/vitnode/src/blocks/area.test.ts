import { describe, expect, it } from "vitest";

import type { AnyBlockInstance, BlockAreaLayout, ContentNode } from "./types";

import {
  AREA_ALIGN_CLASSES,
  AREA_COLUMN_CLASSES,
  AREA_JUSTIFY_CLASSES,
  areaChildren,
  areaLayoutClassNames,
  areaLayoutStyle,
  areaLayoutWithDefaults,
  areaLikeId,
  areaMarginStyle,
  areaSpacing,
  contentNodeBlocks,
  contentNodeId,
  contentNodeKey,
  createAreaInstance,
  DEFAULT_AREA_LAYOUT,
  isAreaAlign,
  isAreaColumns,
  isAreaJustify,
  isAreaLayout,
  isAreaLike,
  isAreaSpacing,
  isBlockAreaInstance,
  isContentNode,
  isLegacyAreaSpacing,
} from "./area";
import { AREA_ALIGNS, AREA_COLUMNS, AREA_JUSTIFIES } from "./const";

const storedLayout = (value: unknown): BlockAreaLayout =>
  value as BlockAreaLayout;

const block = (id: string): AnyBlockInstance => ({
  data: {},
  id,
  type: "core:hero",
});

const area = (layout: unknown, children: unknown = []) => ({
  children,
  id: "AREA1",
  kind: "area",
  layout,
});

describe("area layout tokens", () => {
  it("accepts every token the editor can offer", () => {
    expect(AREA_COLUMNS.every(isAreaColumns)).toBe(true);
    expect(AREA_ALIGNS.every(isAreaAlign)).toBe(true);
    expect(AREA_JUSTIFIES.every(isAreaJustify)).toBe(true);
  });

  it("refuses a column count nobody can lay out", () => {
    for (const bad of [0, 5, -1, 2.5, "2", null, undefined]) {
      expect(isAreaColumns(bad)).toBe(false);
    }
  });

  it("refuses an alignment or justification it does not define", () => {
    expect(isAreaAlign("end")).toBe(false);
    expect(isAreaAlign("baseline")).toBe(false);
    expect(isAreaJustify("around")).toBe(false);
    expect(isAreaJustify("between")).toBe(false);
  });
});

describe("reading a stored layout", () => {
  it("needs a column count and nothing more", () => {
    expect(isAreaLayout({ columns: 2 })).toBe(true);
    expect(isAreaLayout({ align: "center", columns: 3, gap: "lg" })).toBe(true);
  });

  it("refuses a layout with no column count at all", () => {
    expect(isAreaLayout({})).toBe(false);
    expect(isAreaLayout({ gap: "md" })).toBe(false);
  });

  it("refuses a layout carrying a token from another version", () => {
    expect(isAreaLayout({ columns: 2, gap: "huge" })).toBe(false);
    expect(isAreaLayout({ columns: 2, gap: 101 })).toBe(false);
    expect(isAreaLayout({ align: "end", columns: 2 })).toBe(false);
    expect(isAreaLayout({ columns: 2, justify: "evenly" })).toBe(false);
  });

  it("refuses something that is not an object", () => {
    expect(isAreaLayout(null)).toBe(false);
    expect(isAreaLayout([2])).toBe(false);
    expect(isAreaLayout("columns: 2")).toBe(false);
  });

  it("fills the optional tokens in, and coerces one it cannot read", () => {
    expect(areaLayoutWithDefaults({ columns: 3 })).toStrictEqual({
      ...DEFAULT_AREA_LAYOUT,
      columns: 3,
    });

    expect(
      areaLayoutWithDefaults(storedLayout({ align: "end", columns: 9 })),
    ).toStrictEqual(DEFAULT_AREA_LAYOUT);
  });
});

describe("recognising an area", () => {
  it("sees one by its kind before anything else", () => {
    expect(isAreaLike(area({ columns: 2 }))).toBe(true);
    expect(isAreaLike({ kind: "area" })).toBe(true);
    expect(isAreaLike(block("B1"))).toBe(false);
    expect(isAreaLike(null)).toBe(false);
  });

  it("accepts one whose id, layout and children all read", () => {
    expect(isBlockAreaInstance(area({ columns: 2 }, [block("B1")]))).toBe(true);
  });

  it("refuses one whose layout, children or id are malformed", () => {
    expect(isBlockAreaInstance(area({ columns: 9 }))).toBe(false);
    expect(isBlockAreaInstance(area({ columns: 2 }, "two"))).toBe(false);
    expect(isBlockAreaInstance({ ...area({ columns: 2 }), id: "" })).toBe(
      false,
    );
  });

  it("never mistakes a malformed area for a block", () => {
    const malformed = area({ columns: 9 });

    expect(isBlockAreaInstance(malformed)).toBe(false);
    expect(isContentNode(malformed)).toBe(false);
  });

  it("counts both kinds as content nodes", () => {
    expect(isContentNode(area({ columns: 2 }))).toBe(true);
    expect(isContentNode(block("B1"))).toBe(true);
    expect(isContentNode({ id: "B1" })).toBe(false);
  });

  it("reads the id of anything that claims to be an area", () => {
    expect(areaLikeId(area({ columns: 2 }))).toBe("AREA1");
    expect(areaLikeId({ id: 7, kind: "area" })).toBeUndefined();
    expect(areaLikeId(block("B1"))).toBeUndefined();
  });
});

describe("creating an area", () => {
  it("starts empty, two columns wide, with the default spacing", () => {
    const created = createAreaInstance();

    expect(created.kind).toBe("area");
    expect(created.children).toStrictEqual([]);
    expect(created.layout).toStrictEqual(DEFAULT_AREA_LAYOUT);
    expect(isBlockAreaInstance(created)).toBe(true);
  });

  it("takes the layout and the children it is handed", () => {
    const created = createAreaInstance({
      children: [block("B1")],
      layout: { columns: 4, gap: 32 },
    });

    expect(created.layout).toStrictEqual({
      ...DEFAULT_AREA_LAYOUT,
      columns: 4,
      gap: 32,
    });
    expect(created.children).toHaveLength(1);
  });

  it("gives every area its own id", () => {
    expect(createAreaInstance().id).not.toBe(createAreaInstance().id);
  });
});

describe("walking a content list", () => {
  const nodes: ContentNode[] = [
    block("B1"),
    createAreaInstance({ children: [block("B2"), block("B3")] }),
    block("B4"),
  ];

  it("flattens an area to the blocks inside it", () => {
    expect(contentNodeBlocks(nodes).map(one => one.id)).toStrictEqual([
      "B1",
      "B2",
      "B3",
      "B4",
    ]);
  });

  it("reads the children of an area and of nothing else", () => {
    expect(areaChildren(nodes[1]).map(one => one.id)).toStrictEqual([
      "B2",
      "B3",
    ]);
    expect(areaChildren(nodes[0])).toStrictEqual([]);
  });

  it("keys a node by its own id, and a broken one by its position", () => {
    expect(contentNodeId(nodes[0])).toBe("B1");
    expect(contentNodeKey(nodes[0], 3)).toBe("B1");
    expect(contentNodeKey("nonsense", 3)).toBe("at:3");
    expect(contentNodeKey(null, 0)).toBe("at:0");
    expect(contentNodeKey({ id: "" }, 1)).toBe("at:1");
  });
});

describe("the layout class table", () => {
  it("names a class for every token and no token it does not define", () => {
    expect(
      Object.keys(AREA_COLUMN_CLASSES)
        .map(Number)
        .sort((a, b) => a - b),
    ).toStrictEqual([...AREA_COLUMNS]);
    expect(Object.keys(AREA_ALIGN_CLASSES).sort()).toStrictEqual(
      [...AREA_ALIGNS].sort(),
    );
    expect(Object.keys(AREA_JUSTIFY_CLASSES).sort()).toStrictEqual(
      [...AREA_JUSTIFIES].sort(),
    );
  });

  it("stays on one column until the medium breakpoint", () => {
    expect(AREA_COLUMN_CLASSES[1]).toBe("grid-cols-1");
    expect(AREA_COLUMN_CLASSES[2]).toBe("grid-cols-1 md:grid-cols-2");
    expect(AREA_COLUMN_CLASSES[3]).toBe("grid-cols-1 md:grid-cols-3");
    expect(AREA_COLUMN_CLASSES[4]).toBe("grid-cols-1 md:grid-cols-4");
  });

  it("leaves the gap out, because it is pixels rather than a token", () => {
    const classes = areaLayoutClassNames({ columns: 2, gap: 24 });

    expect(classes).not.toContain("gap-");
    expect(classes).not.toContain("[");
  });

  it("is total over every combination of tokens", () => {
    const seen = new Set<string>();

    for (const columns of AREA_COLUMNS) {
      for (const align of AREA_ALIGNS) {
        for (const justify of AREA_JUSTIFIES) {
          const classes = areaLayoutClassNames({ align, columns, justify });

          expect(classes).not.toContain("undefined");
          expect(classes.startsWith("grid ")).toBe(true);
          expect(classes).toContain(AREA_COLUMN_CLASSES[columns]);
          expect(classes).toContain(AREA_ALIGN_CLASSES[align]);
          expect(classes).toContain(AREA_JUSTIFY_CLASSES[justify]);
          seen.add(classes);
        }
      }
    }

    expect(seen.size).toBe(
      AREA_COLUMNS.length * AREA_ALIGNS.length * AREA_JUSTIFIES.length,
    );
  });

  it("falls back to the default layout when a token cannot be read", () => {
    expect(areaLayoutClassNames(storedLayout({ columns: 7 }))).toBe(
      areaLayoutClassNames(DEFAULT_AREA_LAYOUT),
    );
  });

  it("uses only the tokens it was given, with the defaults filled in", () => {
    expect(areaLayoutClassNames({ columns: 2 })).toBe(
      "grid grid-cols-1 md:grid-cols-2 items-stretch justify-items-stretch",
    );
  });
});

describe("spacing measured in pixels", () => {
  it("takes whole pixels from none up to a hundred", () => {
    for (const value of [0, 1, 16, 99, 100]) {
      expect(isAreaSpacing(value)).toBe(true);
    }

    for (const value of [-1, 101, 12.5, "16", "16px", null, undefined]) {
      expect(isAreaSpacing(value)).toBe(false);
    }
  });

  it("still reads a layout stored with the names it used to take", () => {
    expect(isLegacyAreaSpacing("md")).toBe(true);
    expect(isLegacyAreaSpacing("enormous")).toBe(false);

    expect(areaLayoutWithDefaults({ columns: 2, gap: "lg" }).gap).toBe(32);
    expect(areaLayoutWithDefaults({ columns: 2, gap: "none" }).gap).toBe(0);
    expect(areaLayoutWithDefaults({ columns: 2, marginY: "sm" }).marginY).toBe(
      8,
    );
  });

  it("accepts either spelling where a stored layout is checked", () => {
    expect(isAreaLayout({ columns: 2, gap: 40 })).toBe(true);
    expect(isAreaLayout({ columns: 2, gap: "lg" })).toBe(true);
    expect(isAreaLayout({ columns: 2, marginX: -4 })).toBe(false);
  });

  it("falls back rather than letting a value it cannot read through", () => {
    expect(areaSpacing(101, 16)).toBe(16);
    expect(areaSpacing("nonsense", 16)).toBe(16);
    expect(areaSpacing(40, 16)).toBe(40);
  });

  it("defaults a gap to 16px and a margin to none", () => {
    expect(areaLayoutWithDefaults({ columns: 2 })).toMatchObject({
      gap: 16,
      marginX: 0,
      marginY: 0,
    });
  });

  it("writes the gap as an inline pixel value", () => {
    expect(areaLayoutStyle({ columns: 2, gap: 24 })).toStrictEqual({
      gap: "24px",
    });
    expect(areaLayoutStyle({ columns: 2 })).toStrictEqual({ gap: "16px" });
  });
});

describe("the room an area keeps around itself", () => {
  it("draws nothing at all when the area asks for none", () => {
    expect(areaMarginStyle({ columns: 2 })).toBeUndefined();
    expect(
      areaMarginStyle({ columns: 2, marginX: 0, marginY: 0 }),
    ).toBeUndefined();
  });

  it("writes both axes as soon as either is asked for", () => {
    expect(areaMarginStyle({ columns: 2, marginY: 40 })).toStrictEqual({
      marginBlock: "40px",
      marginInline: "0px",
    });
    expect(
      areaMarginStyle({ columns: 2, marginX: 8, marginY: 100 }),
    ).toStrictEqual({ marginBlock: "100px", marginInline: "8px" });
  });
});
