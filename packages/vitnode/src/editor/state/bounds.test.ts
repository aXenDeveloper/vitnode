import { describe, expect, it } from "vitest";

import type { AnyBlockInstance, ContentNode } from "../../blocks/types";
import type { ZoneCapacity } from "./bounds";
import type { EditorZoneState } from "./types";

import { createAreaInstance } from "../../blocks/area";
import { CONTENT_BLOCKS_ABSOLUTE_MAX } from "../../blocks/const";
import { createBlockInstance } from "../../blocks/instance";
import {
  fitsRootNodeCap,
  refusesDuplicate,
  refusesRemoval,
  refusesRootNode,
  refusesUnwrap,
  zoneBlockCount,
  zoneRootNodeCount,
} from "./bounds";

const block = (text: string): AnyBlockInstance =>
  createBlockInstance("core:text", { body: text });

const area = (children: readonly AnyBlockInstance[] = []) =>
  createAreaInstance({ children });

const zoneStateOf = (nodes: readonly ContentNode[]): EditorZoneState => ({
  allowedBlocks: undefined,
  id: "main",
  initial: nodes,
  initialInvalid: [],
  invalid: [],
  max: undefined,
  min: undefined,
  nodes,
  registry: undefined,
  superseded: [],
});

const capacity = (
  blocks: number,
  bounds: { max?: number; min?: number; roots?: number } = {},
): ZoneCapacity => ({
  blocks,
  max: bounds.max,
  min: bounds.min,
  roots: bounds.roots ?? blocks,
});

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

describe("root nodes, which are counted apart from blocks", () => {
  const nodes = (roots: number): ContentNode[] =>
    Array.from({ length: roots }, (_, at) => block(`root-${at}`));

  it("counts an area as one root node however many blocks it holds", () => {
    const holder = area([block("a"), block("b"), block("c")]);

    expect(zoneRootNodeCount([holder])).toBe(1);
    expect(zoneBlockCount([holder])).toBe(3);
  });

  it("counts an empty area as one root node and no blocks at all", () => {
    expect(zoneRootNodeCount([area()])).toBe(1);
    expect(zoneBlockCount([area()])).toBe(0);
  });

  it("lets a zone hold exactly the absolute cap and no more", () => {
    expect(fitsRootNodeCap(CONTENT_BLOCKS_ABSOLUTE_MAX)).toBe(true);
    expect(fitsRootNodeCap(CONTENT_BLOCKS_ABSOLUTE_MAX + 1)).toBe(false);
  });

  it("refuses the root node a zone at the cap has nowhere to put", () => {
    expect(
      refusesRootNode(zoneStateOf(nodes(CONTENT_BLOCKS_ABSOLUTE_MAX))),
    ).toBe(true);
    expect(
      refusesRootNode(zoneStateOf(nodes(CONTENT_BLOCKS_ABSOLUTE_MAX - 1))),
    ).toBe(false);
  });

  it("has nothing to say about a zone that is not mounted", () => {
    expect(refusesRootNode(undefined)).toBe(false);
  });
});

describe("refusesDuplicate, at the absolute root cap", () => {
  it("refuses the copy a zone at the cap would have to keep at its root", () => {
    expect(
      refusesDuplicate(
        capacity(1, { roots: CONTENT_BLOCKS_ABSOLUTE_MAX }),
        1,
        null,
      ),
    ).toBe(true);
  });

  it("takes the copy while the root is one node short of the cap", () => {
    expect(
      refusesDuplicate(
        capacity(1, { roots: CONTENT_BLOCKS_ABSOLUTE_MAX - 1 }),
        1,
        null,
      ),
    ).toBe(false);
  });

  it("leaves a copy inside an area alone, since the root does not grow", () => {
    expect(
      refusesDuplicate(
        capacity(1, { roots: CONTENT_BLOCKS_ABSOLUTE_MAX }),
        1,
        2,
      ),
    ).toBe(false);
  });
});

describe("refusesUnwrap", () => {
  it("refuses an unwrap that would spill past the cap", () => {
    expect(
      refusesUnwrap(capacity(0, { roots: CONTENT_BLOCKS_ABSOLUTE_MAX }), 2),
    ).toBe(true);
  });

  it("takes the unwrap that lands on exactly the cap", () => {
    expect(
      refusesUnwrap(capacity(0, { roots: CONTENT_BLOCKS_ABSOLUTE_MAX }), 1),
    ).toBe(false);
    expect(
      refusesUnwrap(capacity(0, { roots: CONTENT_BLOCKS_ABSOLUTE_MAX - 1 }), 2),
    ).toBe(false);
  });

  it("never refuses to empty an area out of a zone already over the cap", () => {
    expect(
      refusesUnwrap(capacity(0, { roots: CONTENT_BLOCKS_ABSOLUTE_MAX + 5 }), 0),
    ).toBe(false);
  });

  it("has nothing to say about a zone with no capacity at all", () => {
    expect(refusesUnwrap(null, 50)).toBe(false);
  });
});

describe("refusesRemoval, for a block the editor has already rejected", () => {
  it("lets a rejected block out of a zone that is at its min", () => {
    expect(refusesRemoval(capacity(1, { min: 1 }), 1, true)).toBe(false);
    expect(refusesRemoval(capacity(3, { min: 3 }), 1, true)).toBe(false);
  });

  it("keeps refusing the healthy block sitting next to it", () => {
    expect(refusesRemoval(capacity(1, { min: 1 }), 1, false)).toBe(true);
    expect(refusesRemoval(capacity(1, { min: 1 }), 1)).toBe(true);
  });
});
