// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { EditorContainerRef } from "../state/types";
import type { EditorDragSource, EditorDropTarget } from "./resolve-drop";

import {
  AREA_DROPPABLE_PREFIX,
  areaDroppableId,
  CATALOG_DRAGGABLE_PREFIX,
  catalogDraggableId,
  dropEdgeFor,
  dropPlacement,
  dropRejection,
  isAreaDroppableId,
  isContainerDroppableId,
  isZoneDroppableId,
  NODE_DRAGGABLE_PREFIX,
  nodeDraggableId,
  nodeRefFromDraggableId,
  preferInnerCollisions,
  readDragSource,
  readDropTarget,
  resolveDrop,
  ZONE_DROPPABLE_PREFIX,
  zoneDroppableId,
} from "./resolve-drop";

const into = (
  zoneId: string,
  areaId: null | string = null,
): EditorContainerRef => ({ areaId, zoneId });

const source = (
  partial: Partial<{
    container: EditorContainerRef;
    index: number;
    nodeId: string;
    type: string;
  }> = {},
): EditorDragSource => ({
  container: into("page:main"),
  index: 0,
  kind: "existing-block",
  nodeId: "block-a",
  type: "core:hero",
  ...partial,
});

const areaSource = (
  partial: Partial<{
    childTypes: readonly string[];
    container: EditorContainerRef;
    index: number;
    nodeId: string;
  }> = {},
): EditorDragSource => ({
  childTypes: [],
  container: into("page:main"),
  index: 0,
  kind: "existing-area",
  nodeId: "area-a",
  ...partial,
});

const fromCatalog = (type = "core:hero"): EditorDragSource => ({
  kind: "catalog-block",
  type,
});

const onNode = (partial: Partial<EditorDropTarget> = {}): EditorDropTarget => ({
  container: into("page:main"),
  edge: null,
  index: 1,
  kind: "block",
  nodeId: "block-b",
  ...partial,
});

const onContainer = (
  zoneId: string,
  areaId: null | string = null,
): EditorDropTarget => ({
  container: into(zoneId, areaId),
  edge: null,
  index: null,
  kind: null,
  nodeId: null,
});

const blockRef = (
  zoneId: string,
  nodeId: string,
  areaId: null | string = null,
) => ({ areaId, kind: "block", nodeId, zoneId }) as const;

const areaNodeRef = (zoneId: string, nodeId: string) =>
  ({ areaId: null, kind: "area", nodeId, zoneId }) as const;

const decodedSuffix = (id: string, prefix: string): string =>
  decodeURIComponent(id.slice(prefix.length));

describe("zone droppable ids", () => {
  it("round-trips a zone id", () => {
    expect(
      decodedSuffix(zoneDroppableId("page:main"), ZONE_DROPPABLE_PREFIX),
    ).toBe("page:main");
  });

  it("does not claim a block id", () => {
    expect(isZoneDroppableId("01J0000000AAAAAAAAAAAAAAAA")).toBe(false);
  });
});

describe("area droppable ids", () => {
  it("names the zone and the area it belongs to", () => {
    expect(
      decodedSuffix(
        areaDroppableId({ areaId: "area-1", zoneId: "page:main" }),
        AREA_DROPPABLE_PREFIX,
      ),
    ).toBe("page:main/area-1");
  });

  it("gives the same area id a different droppable in each zone", () => {
    expect(areaDroppableId({ areaId: "area-1", zoneId: "page:main" })).not.toBe(
      areaDroppableId({ areaId: "area-1", zoneId: "page:aside" }),
    );
  });

  it("is never mistaken for the zone that contains it", () => {
    const area = areaDroppableId({ areaId: "area-1", zoneId: "page:main" });

    expect(isAreaDroppableId(area)).toBe(true);
    expect(isZoneDroppableId(area)).toBe(false);
    expect(isAreaDroppableId(zoneDroppableId("page:main"))).toBe(false);
    expect(nodeRefFromDraggableId(area)).toBeNull();
  });

  it("counts both a zone and an area as somewhere a drop lands in bulk", () => {
    expect(isContainerDroppableId(zoneDroppableId("page:main"))).toBe(true);
    expect(
      isContainerDroppableId(
        areaDroppableId({ areaId: "area-1", zoneId: "page:main" }),
      ),
    ).toBe(true);
    expect(
      isContainerDroppableId(nodeDraggableId(blockRef("page:main", "block-a"))),
    ).toBe(false);
  });
});

describe("catalog draggable ids", () => {
  it("round-trips a block type", () => {
    expect(
      decodedSuffix(catalogDraggableId("core:hero"), CATALOG_DRAGGABLE_PREFIX),
    ).toBe("core:hero");
  });

  it("cannot be mistaken for a node, an area or a zone", () => {
    expect(nodeRefFromDraggableId(catalogDraggableId("core:hero"))).toBeNull();
    expect(isZoneDroppableId(catalogDraggableId("core:hero"))).toBe(false);
    expect(isAreaDroppableId(catalogDraggableId("core:hero"))).toBe(false);
    expect(nodeRefFromDraggableId(zoneDroppableId("page:main"))).toBeNull();
  });
});

describe("container-aware identity", () => {
  it("gives the same block a different draggable id in each zone", () => {
    expect(nodeDraggableId(blockRef("page:main", "block-x"))).not.toBe(
      nodeDraggableId(blockRef("page:aside", "block-x")),
    );
  });

  it("gives the same block a different draggable id inside an area", () => {
    expect(nodeDraggableId(blockRef("page:main", "block-x"))).not.toBe(
      nodeDraggableId(blockRef("page:main", "block-x", "area-1")),
    );
  });

  it("gives an area and a block of one id different draggables", () => {
    expect(nodeDraggableId(areaNodeRef("page:main", "x"))).not.toBe(
      nodeDraggableId(blockRef("page:main", "x")),
    );
  });

  it("round-trips a node back to the container it was dragged from", () => {
    const refs = [
      blockRef("page:main", "block-x"),
      blockRef("page:aside", "block-x"),
      blockRef("page:main", "block-x", "area-1"),
      areaNodeRef("page:main", "area-1"),
    ];

    for (const ref of refs) {
      expect(nodeRefFromDraggableId(nodeDraggableId(ref))).toEqual(ref);
    }
  });

  it("round-trips ids that carry separators, escapes and spaces", () => {
    const ref = blockRef(
      "page:main/left 50%",
      "block/one:two%three four",
      "area/one two",
    );

    expect(nodeRefFromDraggableId(nodeDraggableId(ref))).toEqual(ref);
    expect(
      decodedSuffix(zoneDroppableId(ref.zoneId), ZONE_DROPPABLE_PREFIX),
    ).toBe(ref.zoneId);
    expect(
      decodedSuffix(
        catalogDraggableId("core:hero/fancy 100%"),
        CATALOG_DRAGGABLE_PREFIX,
      ),
    ).toBe("core:hero/fancy 100%");
  });

  it("reads a node ref out of nothing else", () => {
    expect(nodeRefFromDraggableId(zoneDroppableId("page:main"))).toBeNull();
    expect(nodeRefFromDraggableId(catalogDraggableId("core:hero"))).toBeNull();
    expect(
      nodeRefFromDraggableId(`${NODE_DRAGGABLE_PREFIX}block-x`),
    ).toBeNull();
    expect(
      nodeRefFromDraggableId(`${NODE_DRAGGABLE_PREFIX}widget/z//block-x`),
    ).toBeNull();
    expect(
      nodeRefFromDraggableId(`${NODE_DRAGGABLE_PREFIX}block/z//`),
    ).toBeNull();
  });

  it("takes a drag source's identity from the payload, not the element id", () => {
    const payload = {
      areaId: null,
      index: 0,
      kind: "existing-block",
      nodeId: "block-x",
      type: "core:hero",
    };

    expect(readDragSource({ ...payload, zoneId: "page:main" })).toEqual(
      source({ nodeId: "block-x" }),
    );
    expect(readDragSource({ ...payload, zoneId: "page:aside" })).toEqual(
      source({ container: into("page:aside"), nodeId: "block-x" }),
    );
    expect(
      readDragSource({ ...payload, areaId: "area-1", zoneId: "page:main" }),
    ).toEqual(
      source({ container: into("page:main", "area-1"), nodeId: "block-x" }),
    );
  });

  it("refuses a block payload missing any part of its identity", () => {
    const whole: Record<string, unknown> = {
      areaId: null,
      index: 0,
      kind: "existing-block",
      nodeId: "block-x",
      type: "core:hero",
      zoneId: "page:main",
    };

    for (const missing of ["nodeId", "zoneId", "index", "type"]) {
      const { [missing]: _dropped, ...rest } = whole;

      expect(readDragSource(rest)).toBeNull();
    }
  });

  it("reads an area payload, which carries no block type at all", () => {
    expect(
      readDragSource({
        areaId: null,
        index: 2,
        kind: "existing-area",
        nodeId: "area-1",
        zoneId: "page:main",
      }),
    ).toEqual(areaSource({ index: 2, nodeId: "area-1" }));
  });

  it("takes a drop target from the payload a zone, an area or a node carries", () => {
    expect(
      readDropTarget({ kind: "zone", zoneId: "page:aside" }, null),
    ).toEqual(onContainer("page:aside"));
    expect(
      readDropTarget(
        { areaId: "area-1", kind: "area-container", zoneId: "page:main" },
        "after",
      ),
    ).toEqual(onContainer("page:main", "area-1"));
    expect(
      readDropTarget(
        {
          areaId: "area-1",
          index: 2,
          kind: "existing-block",
          nodeId: "block-x",
          type: "core:hero",
          zoneId: "page:aside",
        },
        "after",
      ),
    ).toEqual(
      onNode({
        container: into("page:aside", "area-1"),
        edge: "after",
        index: 2,
        nodeId: "block-x",
      }),
    );
    expect(
      readDropTarget({ kind: "catalog-block", type: "core:hero" }, "after"),
    ).toBeNull();
    expect(readDropTarget("page:aside", "after")).toBeNull();
  });

  it("refuses a zone payload that claims to be an area", () => {
    expect(
      readDropTarget({ areaId: "area-1", kind: "zone", zoneId: "z" }, null),
    ).toBeNull();
  });

  it("reads an area node as a target of its own, at the zone root", () => {
    expect(
      readDropTarget(
        {
          areaId: null,
          index: 1,
          kind: "existing-area",
          nodeId: "area-1",
          zoneId: "page:main",
        },
        "before",
      ),
    ).toEqual(
      onNode({ edge: "before", kind: "area", index: 1, nodeId: "area-1" }),
    );
  });
});

describe("readDragSource", () => {
  it("reads the payload a catalog entry carries", () => {
    expect(
      readDragSource({ kind: "catalog-block", type: "core:text" }),
    ).toEqual({ kind: "catalog-block", type: "core:text" });
  });

  it("refuses a payload that is not a node", () => {
    expect(readDragSource(undefined)).toBeNull();
    expect(readDragSource([1, 2])).toBeNull();
    expect(readDragSource({ zoneId: "page:main" })).toBeNull();
    expect(
      readDragSource({
        areaId: null,
        index: "2",
        kind: "existing-block",
        nodeId: "block-a",
        type: "core:text",
        zoneId: "z",
      }),
    ).toBeNull();
  });

  it("refuses a payload whose kind it does not know", () => {
    expect(
      readDragSource({
        areaId: null,
        index: 2,
        nodeId: "block-a",
        type: "core:text",
        zoneId: "page:main",
      }),
    ).toBeNull();
    expect(
      readDragSource({
        areaId: null,
        index: 2,
        kind: "block",
        nodeId: "block-a",
        type: "core:text",
        zoneId: "page:main",
      }),
    ).toBeNull();
    expect(readDragSource({ kind: "catalog-block" })).toBeNull();
    expect(readDragSource({ kind: "catalog-block", type: "" })).toBeNull();
  });

  it("refuses a payload whose area is neither a name nor nothing", () => {
    expect(
      readDragSource({
        areaId: 7,
        index: 0,
        kind: "existing-block",
        nodeId: "block-a",
        type: "core:text",
        zoneId: "page:main",
      }),
    ).toBeNull();
  });
});

describe("readDropTarget", () => {
  it("reads a zone droppable as an append target with no edge", () => {
    expect(
      readDropTarget({ kind: "zone", zoneId: "page:aside" }, "after"),
    ).toEqual(onContainer("page:aside"));
  });

  it("reads an area droppable as an append target inside that area", () => {
    expect(
      readDropTarget(
        { areaId: "area-1", kind: "area-container", zoneId: "page:main" },
        "before",
      ),
    ).toEqual(onContainer("page:main", "area-1"));
  });

  it("never treats a catalog entry as somewhere to drop", () => {
    expect(
      readDropTarget({ kind: "catalog-block", type: "core:hero" }, "before"),
    ).toBeNull();
  });

  it("refuses anything else", () => {
    expect(readDropTarget(null, null)).toBeNull();
    expect(readDropTarget({ kind: "zone" }, null)).toBeNull();
    expect(readDropTarget({ kind: "area-container" }, null)).toBeNull();
  });
});

describe("dropEdgeFor", () => {
  const rect = { height: 100, left: 400, top: 200, width: 100 };

  it("is before above the midpoint and after below it", () => {
    expect(dropEdgeFor({ pointerY: 220, rect })).toBe("before");
    expect(dropEdgeFor({ pointerY: 250, rect })).toBe("after");
    expect(dropEdgeFor({ pointerY: 280, rect })).toBe("after");
  });

  it("reads the inline axis inside a multi-column area", () => {
    const at = (pointerX: number) =>
      dropEdgeFor({ axis: "horizontal", pointerX, pointerY: 280, rect });

    expect(at(420)).toBe("before");
    expect(at(480)).toBe("after");
  });

  it("ignores the block axis entirely once it reads the inline one", () => {
    const at = (pointerY: number) =>
      dropEdgeFor({ axis: "horizontal", pointerX: 420, pointerY, rect });

    expect(at(210)).toBe("before");
    expect(at(290)).toBe("before");
  });

  it("mirrors before and after when the page reads right to left", () => {
    const at = (pointerX: number) =>
      dropEdgeFor({
        axis: "horizontal",
        pointerX,
        pointerY: 250,
        rect,
        rtl: true,
      });

    expect(at(480)).toBe("before");
    expect(at(420)).toBe("after");
  });

  it("stays vertical when the pointer has no inline position to read", () => {
    expect(dropEdgeFor({ axis: "horizontal", pointerY: 220, rect })).toBe(
      "before",
    );
  });
});

describe("preferInnerCollisions", () => {
  const zone = { id: zoneDroppableId("page:main") };
  const areaBody = {
    id: areaDroppableId({ areaId: "area-1", zoneId: "page:main" }),
  };
  const areaNode = { id: nodeDraggableId(areaNodeRef("page:main", "area-1")) };
  const rootBlock = { id: nodeDraggableId(blockRef("page:main", "block-a")) };
  const insideBlock = {
    id: nodeDraggableId(blockRef("page:main", "block-b", "area-1")),
  };

  it("prefers a block inside an area over the area, and over the zone", () => {
    expect(
      preferInnerCollisions([zone, areaNode, areaBody, insideBlock]),
    ).toEqual([insideBlock]);
  });

  it("prefers the area's body over the area's own edges, so an empty area can be filled", () => {
    expect(preferInnerCollisions([zone, areaNode, areaBody])).toEqual([
      areaBody,
    ]);
  });

  it("prefers a root node over the zone when no area is under the pointer", () => {
    expect(preferInnerCollisions([zone, rootBlock, areaNode])).toEqual([
      rootBlock,
      areaNode,
    ]);
  });

  it("leaves the area's own edges reachable where its body is not hit", () => {
    expect(preferInnerCollisions([zone, areaNode])).toEqual([areaNode]);
  });

  it("falls back to the zone when nothing nearer is hit", () => {
    expect(preferInnerCollisions([zone])).toEqual([zone]);
  });

  it("falls back rather than ranking an id it cannot read", () => {
    const collisions = [zone, { id: "something-else" }];

    expect(preferInnerCollisions(collisions)).toEqual(collisions);
  });

  it("stays empty when nothing collides", () => {
    expect(preferInnerCollisions([])).toEqual([]);
  });
});

describe("dropRejection", () => {
  it("refuses an area dropped into an area, and nowhere else", () => {
    expect(
      dropRejection({
        allowedBlocks: "*",
        source: areaSource(),
        target: onContainer("page:main", "area-2"),
      }),
    ).toBe("nested-area");
    expect(
      dropRejection({
        allowedBlocks: "*",
        source: areaSource(),
        target: onContainer("page:aside"),
      }),
    ).toBeNull();
  });

  it("refuses an area landing on a block that lives inside an area", () => {
    expect(
      dropRejection({
        allowedBlocks: "*",
        source: areaSource(),
        target: onNode({
          container: into("page:main", "area-2"),
          edge: "before",
        }),
      }),
    ).toBe("nested-area");
  });

  it("never asks the block allowlist about an area", () => {
    expect(
      dropRejection({
        allowedBlocks: ["core:*"],
        source: areaSource(),
        target: onContainer("page:aside"),
      }),
    ).toBeNull();
  });

  it("refuses a block the target zone does not allow, inside an area too", () => {
    expect(
      dropRejection({
        allowedBlocks: ["core:*"],
        source: source({ type: "example:callout" }),
        target: onContainer("page:main", "area-1"),
      }),
    ).toBe("not-allowed");
    expect(
      dropRejection({
        allowedBlocks: ["example:*"],
        source: source({ type: "example:callout" }),
        target: onContainer("page:main", "area-1"),
      }),
    ).toBeNull();
  });

  it("says nothing at all with nowhere to drop", () => {
    expect(
      dropRejection({ allowedBlocks: "*", source: source(), target: null }),
    ).toBeNull();
  });
});

describe("resolveDrop", () => {
  it("drops nothing without a target", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source(),
        target: null,
        targetNodeCount: 3,
      }),
    ).toBeNull();
  });

  it("drops nothing on the dragged node itself", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 1 }),
        target: onNode({ index: 1, nodeId: "block-a" }),
        targetNodeCount: 3,
      }),
    ).toBeNull();
  });

  it("moves to the index of the node it was dropped on", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onNode({ index: 2, nodeId: "block-c" }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:main"),
      toIndex: 2,
    });
  });

  it("appends to the end of its own container, accounting for its own removal", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onContainer("page:main"),
        targetNodeCount: 3,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:main"),
      toIndex: 2,
    });
  });

  it("drops nothing when the node is already where it would land", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 2 }),
        target: onContainer("page:main"),
        targetNodeCount: 3,
      }),
    ).toBeNull();
  });

  it("appends past the last node of another zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onContainer("page:aside"),
        targetNodeCount: 2,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:aside"),
      toIndex: 2,
    });
  });

  it("lands at index 0 in an empty zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 1 }),
        target: onContainer("page:aside"),
        targetNodeCount: 0,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:aside"),
      toIndex: 0,
    });
  });

  it("clamps an index the target container cannot hold", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source(),
        target: onNode({
          container: into("page:aside"),
          index: 9,
          nodeId: "block-z",
        }),
        targetNodeCount: 2,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:aside"),
      toIndex: 2,
    });
  });

  it("accepts a type the target zone allows by namespace", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["core:*"],
        source: source({ type: "core:hero" }),
        target: onContainer("page:aside"),
        targetNodeCount: 0,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:aside"),
      toIndex: 0,
    });
  });

  it("refuses a type the target zone does not allow", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["core:*"],
        source: source({ type: "example:callout" }),
        target: onContainer("page:aside"),
        targetNodeCount: 0,
      }),
    ).toBeNull();
  });

  it("treats a zone without an allowlist as open to every block", () => {
    expect(
      resolveDrop({
        allowedBlocks: undefined,
        source: source({ type: "example:callout" }),
        target: onContainer("page:aside"),
        targetNodeCount: 0,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:aside"),
      toIndex: 0,
    });
  });
});

describe("resolveDrop, in and out of an area", () => {
  it("takes a block from the zone root into an area", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onContainer("page:main", "area-1"),
        targetNodeCount: 2,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:main", "area-1"),
      toIndex: 2,
    });
  });

  it("takes an area's child back out to the zone root", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ container: into("page:main", "area-1"), index: 0 }),
        target: onNode({ edge: "before", index: 1, nodeId: "block-b" }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      from: into("page:main", "area-1"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:main"),
      toIndex: 1,
    });
  });

  it("takes an area's child straight into another area", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ container: into("page:main", "area-1"), index: 0 }),
        target: onContainer("page:main", "area-2"),
        targetNodeCount: 1,
      }),
    ).toEqual({
      from: into("page:main", "area-1"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:main", "area-2"),
      toIndex: 1,
    });
  });

  it("reorders inside an area exactly as it does at a zone root", () => {
    const inside = into("page:main", "area-1");

    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ container: inside, index: 0 }),
        target: onNode({
          container: inside,
          edge: "after",
          index: 2,
          nodeId: "block-c",
        }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      from: inside,
      kind: "move",
      nodeId: "block-a",
      to: inside,
      toIndex: 2,
    });

    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ container: inside, index: 1 }),
        target: onNode({
          container: inside,
          edge: "after",
          index: 0,
          nodeId: "block-b",
        }),
        targetNodeCount: 3,
      }),
    ).toBeNull();
  });

  it("treats the same id in the root and in an area as two different nodes", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0, nodeId: "block-x" }),
        target: onNode({
          container: into("page:main", "area-1"),
          edge: "after",
          index: 0,
          nodeId: "block-x",
        }),
        targetNodeCount: 1,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-x",
      to: into("page:main", "area-1"),
      toIndex: 1,
    });
  });

  it("reorders an area among the blocks at the zone root", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: areaSource({ index: 2 }),
        target: onNode({ edge: "before", index: 0, nodeId: "block-a" }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "area-a",
      to: into("page:main"),
      toIndex: 0,
    });
  });

  it("carries an area into another zone's root", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["core:*"],
        source: areaSource({ index: 0 }),
        target: onContainer("page:aside"),
        targetNodeCount: 1,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "area-a",
      to: into("page:aside"),
      toIndex: 1,
    });
  });

  it("refuses an area dropped into an area, wherever inside it lands", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: areaSource(),
        target: onContainer("page:main", "area-2"),
        targetNodeCount: 0,
      }),
    ).toBeNull();
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: areaSource(),
        target: onNode({
          container: into("page:main", "area-2"),
          edge: "after",
          index: 0,
        }),
        targetNodeCount: 1,
      }),
    ).toBeNull();
  });

  it("refuses a block the zone's allowlist rejects, inside one of its areas", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["core:*"],
        source: fromCatalog("example:callout"),
        target: onContainer("page:main", "area-1"),
        targetNodeCount: 0,
      }),
    ).toBeNull();
    expect(
      resolveDrop({
        allowedBlocks: ["core:*"],
        source: source({ type: "example:callout" }),
        target: onNode({
          container: into("page:main", "area-1"),
          edge: "before",
          index: 0,
        }),
        targetNodeCount: 1,
      }),
    ).toBeNull();
  });
});

describe("resolveDrop, by pointer edge", () => {
  it("lands a block above the one it was dropped on", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onNode({ edge: "before", index: 2, nodeId: "block-c" }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:main"),
      toIndex: 1,
    });
  });

  it("lands a block below the one it was dropped on", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onNode({ edge: "after", index: 2, nodeId: "block-c" }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:main"),
      toIndex: 2,
    });
  });

  it("counts an upward move against the list it was removed from", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 3 }),
        target: onNode({ edge: "before", index: 1 }),
        targetNodeCount: 4,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:main"),
      toIndex: 1,
    });

    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 3 }),
        target: onNode({ edge: "after", index: 1 }),
        targetNodeCount: 4,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:main"),
      toIndex: 2,
    });
  });

  it("drops nothing when the edge names the place it already sits", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 1 }),
        target: onNode({ edge: "after", index: 0 }),
        targetNodeCount: 3,
      }),
    ).toBeNull();
  });

  it("makes room for a block arriving from another zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onNode({
          container: into("page:aside"),
          edge: "after",
          index: 1,
          nodeId: "block-z",
        }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      from: into("page:main"),
      kind: "move",
      nodeId: "block-a",
      to: into("page:aside"),
      toIndex: 2,
    });
  });
});

describe("resolveDrop, when the same block id lives in two zones", () => {
  it("moves the copy that was dragged, not the one in the target zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({
          container: into("page:aside"),
          index: 0,
          nodeId: "block-x",
        }),
        target: onNode({ edge: "before", index: 1 }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      from: into("page:aside"),
      kind: "move",
      nodeId: "block-x",
      to: into("page:main"),
      toIndex: 1,
    });
  });

  it("treats a drop onto the other zone's namesake as a real move", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({
          container: into("page:aside"),
          index: 0,
          nodeId: "block-x",
        }),
        target: onNode({ edge: "after", index: 2, nodeId: "block-x" }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      from: into("page:aside"),
      kind: "move",
      nodeId: "block-x",
      to: into("page:main"),
      toIndex: 3,
    });
  });

  it("still drops nothing onto itself within its own container", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 2, nodeId: "block-x" }),
        target: onNode({ edge: "after", index: 2, nodeId: "block-x" }),
        targetNodeCount: 3,
      }),
    ).toBeNull();
  });

  it("leaves the target zone's namesake in the list it is landing among", () => {
    expect(
      dropPlacement({
        container: into("page:main"),
        nodeIds: ["block-w", "block-x", "block-y"],
        overNodeId: "block-x",
        resolved: {
          from: into("page:aside"),
          kind: "move",
          nodeId: "block-x",
          to: into("page:main"),
          toIndex: 1,
        },
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "before",
        nodeId: "block-x",
        zoneId: "page:main",
      },
      position: 2,
      total: 4,
    });

    expect(
      dropPlacement({
        container: into("page:main"),
        nodeIds: ["block-w", "block-x", "block-y"],
        overNodeId: "block-y",
        resolved: {
          from: into("page:main"),
          kind: "move",
          nodeId: "block-x",
          to: into("page:main"),
          toIndex: 1,
        },
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "before",
        nodeId: "block-y",
        zoneId: "page:main",
      },
      position: 2,
      total: 3,
    });
  });

  it("keeps a block that left an area in the list it is landing among", () => {
    expect(
      dropPlacement({
        container: into("page:main"),
        nodeIds: ["block-w", "block-x"],
        overNodeId: "block-x",
        resolved: {
          from: into("page:main", "area-1"),
          kind: "move",
          nodeId: "block-x",
          to: into("page:main"),
          toIndex: 1,
        },
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "before",
        nodeId: "block-x",
        zoneId: "page:main",
      },
      position: 2,
      total: 3,
    });
  });
});

describe("resolveDrop, from the catalog", () => {
  it("inserts before the block it was dropped on", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog("core:text"),
        target: onNode({ edge: "before", index: 1 }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      kind: "insert",
      to: into("page:main"),
      toIndex: 1,
      type: "core:text",
    });
  });

  it("inserts after the block it was dropped on", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog("core:text"),
        target: onNode({ edge: "after", index: 1 }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      kind: "insert",
      to: into("page:main"),
      toIndex: 2,
      type: "core:text",
    });
  });

  it("inserts straight into an area", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog("core:text"),
        target: onContainer("page:main", "area-1"),
        targetNodeCount: 2,
      }),
    ).toEqual({
      kind: "insert",
      to: into("page:main", "area-1"),
      toIndex: 2,
      type: "core:text",
    });

    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog("core:text"),
        target: onNode({
          container: into("page:main", "area-1"),
          edge: "before",
          index: 1,
        }),
        targetNodeCount: 2,
      }),
    ).toEqual({
      kind: "insert",
      to: into("page:main", "area-1"),
      toIndex: 1,
      type: "core:text",
    });
  });

  it("never adjusts for a removal, because nothing is removed", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog(),
        target: onNode({ edge: "before", index: 2 }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      kind: "insert",
      to: into("page:main"),
      toIndex: 2,
      type: "core:hero",
    });
  });

  it("appends when it is dropped on the zone itself", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog(),
        target: onContainer("page:main"),
        targetNodeCount: 3,
      }),
    ).toEqual({
      kind: "insert",
      to: into("page:main"),
      toIndex: 3,
      type: "core:hero",
    });
  });

  it("lands at index 0 in an empty zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog(),
        target: onContainer("page:aside"),
        targetNodeCount: 0,
      }),
    ).toEqual({
      kind: "insert",
      to: into("page:aside"),
      toIndex: 0,
      type: "core:hero",
    });
  });

  it("clamps an index past the end of the container", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog(),
        target: onNode({ edge: "after", index: 9 }),
        targetNodeCount: 2,
      }),
    ).toEqual({
      kind: "insert",
      to: into("page:main"),
      toIndex: 2,
      type: "core:hero",
    });
  });

  it("is refused by the target zone's allowlist", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["core:*"],
        source: fromCatalog("example:callout"),
        target: onContainer("page:main"),
        targetNodeCount: 0,
      }),
    ).toBeNull();
  });

  it("is accepted when the allowlist names its namespace", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["example:*"],
        source: fromCatalog("example:callout"),
        target: onContainer("page:main"),
        targetNodeCount: 1,
      }),
    ).toEqual({
      kind: "insert",
      to: into("page:main"),
      toIndex: 1,
      type: "example:callout",
    });
  });
});

const ids = ["block-a", "block-b", "block-c"];

const placeFor = ({
  allowedBlocks = "*",
  nodeIds = ids,
  source: dragged,
  target,
  targetNodeCount = nodeIds.length,
}: {
  allowedBlocks?: "*" | readonly string[];
  nodeIds?: readonly string[];
  source: EditorDragSource;
  target: EditorDropTarget;
  targetNodeCount?: number;
}) => {
  const resolved = resolveDrop({
    allowedBlocks,
    source: dragged,
    target,
    targetNodeCount,
  });
  if (resolved === null) return null;

  return dropPlacement({
    container: target.container,
    nodeIds,
    overNodeId: target.nodeId,
    resolved,
  });
};

describe("dropPlacement, from the catalog", () => {
  it("keeps the pointer's own edge on the block it is over", () => {
    expect(
      placeFor({
        source: fromCatalog("core:text"),
        target: onNode({ edge: "before", index: 1 }),
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "before",
        nodeId: "block-b",
        zoneId: "page:main",
      },
      position: 2,
      total: 4,
    });

    expect(
      placeFor({
        source: fromCatalog("core:text"),
        target: onNode({ edge: "after", index: 1 }),
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "after",
        nodeId: "block-b",
        zoneId: "page:main",
      },
      position: 3,
      total: 4,
    });
  });

  it("points after the last node when the zone itself is the target", () => {
    expect(
      placeFor({ source: fromCatalog(), target: onContainer("page:main") }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "after",
        nodeId: "block-c",
        zoneId: "page:main",
      },
      position: 4,
      total: 4,
    });
  });

  it("shows no line in an empty container, because there is nothing to draw it against", () => {
    expect(
      placeFor({
        nodeIds: [],
        source: fromCatalog(),
        target: onContainer("page:aside"),
        targetNodeCount: 0,
      }),
    ).toEqual({ indicator: null, position: 1, total: 1 });
    expect(
      placeFor({
        nodeIds: [],
        source: fromCatalog(),
        target: onContainer("page:main", "area-1"),
        targetNodeCount: 0,
      }),
    ).toEqual({ indicator: null, position: 1, total: 1 });
  });

  it("draws the line inside the area it is dropping into", () => {
    expect(
      placeFor({
        nodeIds: ["block-x", "block-y"],
        source: fromCatalog("core:text"),
        target: onNode({
          container: into("page:main", "area-1"),
          edge: "after",
          index: 0,
          nodeId: "block-x",
        }),
        targetNodeCount: 2,
      }),
    ).toEqual({
      indicator: {
        areaId: "area-1",
        axis: "vertical",
        edge: "after",
        nodeId: "block-x",
        zoneId: "page:main",
      },
      position: 2,
      total: 3,
    });
  });
});

describe("dropPlacement, moving a node", () => {
  it("counts the landing against the list the node was removed from", () => {
    expect(
      placeFor({
        source: source({ index: 0 }),
        target: onNode({ edge: "after", index: 2, nodeId: "block-c" }),
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "after",
        nodeId: "block-c",
        zoneId: "page:main",
      },
      position: 3,
      total: 3,
    });
  });

  it("never draws the line against the node being dragged", () => {
    const placement = placeFor({
      source: source({ index: 1, nodeId: "block-b" }),
      target: onNode({ edge: "after", index: 2, nodeId: "block-c" }),
    });

    expect(placement?.indicator).toEqual({
      areaId: null,
      axis: "vertical",
      edge: "after",
      nodeId: "block-c",
      zoneId: "page:main",
    });
  });

  it("places a keyboard drag, which carries no pointer edge at all", () => {
    expect(
      placeFor({
        source: source({ index: 0 }),
        target: onNode({ edge: null, index: 2, nodeId: "block-c" }),
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "after",
        nodeId: "block-c",
        zoneId: "page:main",
      },
      position: 3,
      total: 3,
    });

    expect(
      placeFor({
        source: source({ index: 2, nodeId: "block-c" }),
        target: onNode({ edge: null, index: 0, nodeId: "block-a" }),
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "before",
        nodeId: "block-a",
        zoneId: "page:main",
      },
      position: 1,
      total: 3,
    });
  });

  it("shows nothing at all when the drop would change nothing", () => {
    expect(
      placeFor({
        source: source({ index: 1 }),
        target: onNode({ edge: "after", index: 0 }),
      }),
    ).toBeNull();
  });

  it("shows nothing at all when the zone refuses the block", () => {
    expect(
      placeFor({
        allowedBlocks: ["core:*"],
        source: source({ type: "example:callout" }),
        target: onNode({ edge: "before", index: 1 }),
      }),
    ).toBeNull();
  });

  it("shows nothing at all for an area over another area", () => {
    expect(
      placeFor({
        nodeIds: ["block-x"],
        source: areaSource(),
        target: onContainer("page:main", "area-2"),
        targetNodeCount: 1,
      }),
    ).toBeNull();
  });

  it("makes room for a block arriving from another zone", () => {
    expect(
      placeFor({
        nodeIds: ["block-x", "block-y"],
        source: source({ index: 0 }),
        target: onNode({
          container: into("page:aside"),
          edge: "after",
          index: 1,
          nodeId: "block-y",
        }),
        targetNodeCount: 2,
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "after",
        nodeId: "block-y",
        zoneId: "page:aside",
      },
      position: 3,
      total: 3,
    });
  });

  it("reorders inside an area with the very same indicator it draws at a root", () => {
    const inside = into("page:main", "area-1");

    expect(
      placeFor({
        nodeIds: ["block-a", "block-b", "block-c"],
        source: source({ container: inside, index: 0 }),
        target: onNode({
          container: inside,
          edge: "after",
          index: 2,
          nodeId: "block-c",
        }),
        targetNodeCount: 3,
      }),
    ).toEqual({
      indicator: {
        areaId: "area-1",
        axis: "vertical",
        edge: "after",
        nodeId: "block-c",
        zoneId: "page:main",
      },
      position: 3,
      total: 3,
    });
  });
});

describe("dropPlacement, on its own", () => {
  it("falls back to the gap when the node it is over is not in the list", () => {
    expect(
      dropPlacement({
        container: into("page:main"),
        nodeIds: ids,
        overNodeId: "block-gone",
        resolved: {
          kind: "insert",
          to: into("page:main"),
          toIndex: 1,
          type: "core:text",
        },
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "before",
        nodeId: "block-b",
        zoneId: "page:main",
      },
      position: 2,
      total: 4,
    });
  });

  it("clamps a landing index the list cannot hold", () => {
    expect(
      dropPlacement({
        container: into("page:main"),
        nodeIds: ids,
        overNodeId: null,
        resolved: {
          kind: "insert",
          to: into("page:main"),
          toIndex: 9,
          type: "core:text",
        },
      }),
    ).toEqual({
      indicator: {
        areaId: null,
        axis: "vertical",
        edge: "after",
        nodeId: "block-c",
        zoneId: "page:main",
      },
      position: 4,
      total: 4,
    });
  });
});

describe("an area carries its children past a zone's allowlist", () => {
  const sidebar = { container: into("page:sidebar") };

  const targetAt = (container: EditorContainerRef): EditorDropTarget => ({
    container,
    edge: null,
    index: null,
    kind: null,
    nodeId: null,
  });

  it("refuses an area whose child the target zone does not allow", () => {
    expect(
      dropRejection({
        allowedBlocks: ["core:text"],
        source: areaSource({ childTypes: ["core:cta"] }),
        target: targetAt(sidebar.container),
      }),
    ).toBe("not-allowed");
  });

  it("refuses it even when only one of several children is disallowed", () => {
    expect(
      dropRejection({
        allowedBlocks: ["core:text"],
        source: areaSource({ childTypes: ["core:text", "core:cta"] }),
        target: targetAt(sidebar.container),
      }),
    ).toBe("not-allowed");
  });

  it("allows an area whose children the target zone all accept", () => {
    expect(
      dropRejection({
        allowedBlocks: ["core:text"],
        source: areaSource({ childTypes: ["core:text"] }),
        target: targetAt(sidebar.container),
      }),
    ).toBeNull();
  });

  it("allows an empty area anywhere, because it carries nothing", () => {
    expect(
      dropRejection({
        allowedBlocks: ["core:text"],
        source: areaSource({ childTypes: [] }),
        target: targetAt(sidebar.container),
      }),
    ).toBeNull();
  });

  it("never blocks a reorder inside the zone the area already sits in", () => {
    expect(
      dropRejection({
        allowedBlocks: ["core:text"],
        source: areaSource({
          childTypes: ["core:cta"],
          container: into("page:main"),
        }),
        target: targetAt(into("page:main")),
      }),
    ).toBeNull();
  });

  it("still refuses an area dropped inside another area", () => {
    expect(
      dropRejection({
        allowedBlocks: "*",
        source: areaSource({ childTypes: [] }),
        target: targetAt(into("page:main", "area-b")),
      }),
    ).toBe("nested-area");
  });
});

describe("collision precedence knows what is being dragged", () => {
  const innerBlock = {
    id: nodeDraggableId(blockRef("page:main", "child-1", "area-b")),
  };
  const areaInterior = {
    id: areaDroppableId({ areaId: "area-b", zoneId: "page:main" }),
  };
  const areaAtRoot = {
    id: nodeDraggableId(areaNodeRef("page:main", "area-b")),
  };
  const zone = { id: zoneDroppableId("page:main") };

  const collisions = [innerBlock, areaInterior, areaAtRoot, zone];

  it("lets a block reach the inside of an area, as before", () => {
    expect(
      preferInnerCollisions(collisions, source({ type: "core:text" })),
    ).toStrictEqual([innerBlock]);
  });

  it("gives a dragged area the target area's own root slot, not its inside", () => {
    expect(preferInnerCollisions(collisions, areaSource())).toStrictEqual([
      areaAtRoot,
    ]);
  });

  it("does not strand a dragged area over an empty area's interior", () => {
    expect(
      preferInnerCollisions([areaInterior, areaAtRoot, zone], areaSource()),
    ).toStrictEqual([areaAtRoot]);
  });

  it("falls through to the zone when an area is over nothing reorderable", () => {
    expect(
      preferInnerCollisions([areaInterior, zone], areaSource()),
    ).toStrictEqual([areaInterior, zone]);
  });

  it("behaves exactly as before when nothing says what is dragged", () => {
    expect(preferInnerCollisions(collisions)).toStrictEqual([innerBlock]);
  });
});
