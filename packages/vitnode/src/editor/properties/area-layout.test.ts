// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { BlockAreaInstance } from "../../blocks/types";

import {
  AREA_JUSTIFY_CLASSES,
  areaLayoutClassNames,
  areaLayoutWithDefaults,
} from "../../blocks/area";
import { DEFAULT_AREA_LAYOUT } from "../../blocks/area";
import {
  AREA_LAYOUT_OPTIONS,
  areaDeleteMode,
  nextAreaLayout,
} from "./area-layout";

const area = (children: BlockAreaInstance["children"]): BlockAreaInstance => ({
  children,
  id: "A1",
  kind: "area",
  layout: { columns: 2 },
});

describe("nextAreaLayout", () => {
  it("answers with a whole layout, so a token a stored area omitted is written down", () => {
    expect(nextAreaLayout({ columns: 2 }, { columns: 4 })).toStrictEqual({
      ...DEFAULT_AREA_LAYOUT,
      columns: 4,
    });
  });

  it("keeps every token the person did not touch", () => {
    expect(
      nextAreaLayout(
        { align: "center", columns: 3, gap: "lg", justify: "stretch" },
        { gap: "none" },
      ),
    ).toStrictEqual({
      align: "center",
      columns: 3,
      gap: "none",
      justify: "stretch",
    });
  });

  it("never mutates the layout it was handed", () => {
    const layout = { columns: 2 } as const;

    nextAreaLayout(layout, { columns: 1 });

    expect(layout).toStrictEqual({ columns: 2 });
  });
});

describe("AREA_LAYOUT_OPTIONS", () => {
  it("offers exactly the tokens an area may be stored with", () => {
    expect(AREA_LAYOUT_OPTIONS.columns).toStrictEqual([1, 2, 3, 4]);
    expect(AREA_LAYOUT_OPTIONS.gap).toStrictEqual(["none", "sm", "md", "lg"]);
    expect(AREA_LAYOUT_OPTIONS.align).toStrictEqual([
      "start",
      "center",
      "stretch",
    ]);
    expect(AREA_LAYOUT_OPTIONS.justify).toStrictEqual([
      "start",
      "center",
      "stretch",
    ]);
  });
});

describe("areaDeleteMode", () => {
  it("deletes an empty area without asking what to do with nothing", () => {
    expect(areaDeleteMode(area([]))).toBe("empty");
  });

  it("asks before it takes blocks down with the layout around them", () => {
    expect(
      areaDeleteMode(area([{ data: {}, id: "B1", type: "core:text" }])),
    ).toBe("holds-blocks");
  });
});

describe("the layout the panel actually shows", () => {
  it("resolves every omitted token to its real default, not the first option", () => {
    expect(areaLayoutWithDefaults({ columns: 2 })).toStrictEqual({
      align: "stretch",
      columns: 2,
      gap: "md",
      justify: "stretch",
    });
  });

  it("agrees with the classes the canvas draws for the same layout", () => {
    const stored = { align: "stretch", columns: 2, gap: "md" } as const;
    const shown = areaLayoutWithDefaults(stored);

    expect(areaLayoutClassNames(stored)).toContain(
      AREA_JUSTIFY_CLASSES[shown.justify],
    );
  });
});
